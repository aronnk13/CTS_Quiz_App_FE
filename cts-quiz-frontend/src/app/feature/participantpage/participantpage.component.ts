import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat, BrowserQRCodeReader } from '@zxing/library';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';

@Component({
  selector: 'app-participant-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ZXingScannerModule, MatSnackBarModule],
  templateUrl: './participantpage.component.html',
  styleUrls: ['./participantpage.component.css']
})
export class ParticipantPageComponent implements OnInit {
  // Form fields
  code = '';
  userName = '';
  showWarning = false;
  isJoining = false;
  
  // Scanner
  scannerActive = false;
  availableCameras: MediaDeviceInfo[] = [];
  selectedCamera?: MediaDeviceInfo;
  
  private lastBackWarnAt = 0;
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private participantService: ParticipantService
  ) {}

  ngOnInit(): void {
    this.lockBackNavigation();
    
    this.route.queryParamMap.subscribe(params => {
      const paramCode = params.get('code');
      const quizNumber = params.get('quizNumber');
      const incoming = paramCode ?? quizNumber;
      if (incoming) {
        this.code = incoming;
      }
    });
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.lockBackNavigation();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled during quiz join.', 'Close', { 
        duration: 2000,
        panelClass: ['participant-snackbar']
      });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isJoining) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private lockBackNavigation(): void {
    window.history.pushState(null, '', window.location.href);
  }

  // Navigate back
  goBack(): void {
    this.router.navigate(['/']);
  }

  // Name validation
  validateName(value: string): void {
    const hasInvalidChars = /[^a-zA-Z\s]/.test(value);
    this.showWarning = hasInvalidChars;
    this.userName = value;
  }

  // Join quiz directly with both username and code
  async onJoinQuiz(event: Event): Promise<void> {
    event.preventDefault();
    
    if (this.showWarning || !this.userName.trim() || !this.code.trim()) {
      this.snackBar.open('⚠️ Please enter both name and quiz code', 'Close', {
        duration: 3000,
        panelClass: ['participant-snackbar']
      });
      return;
    }

    this.isJoining = true;
    const cleanedName = this.userName.trim();
    const cleanedCode = this.code.trim();

    try {
      // Step 1: Validate session code
      const validation = await this.participantService.validateSessionCode(cleanedCode);
      
      if (!validation.isValid) {
        this.snackBar.open(`❌ ${validation.message}`, 'Close', {
          duration: 5000,
          panelClass: ['participant-snackbar']
        });
        this.isJoining = false;
        return;
      }

      // Store session data
      localStorage.setItem('sessionData', JSON.stringify(validation));
      localStorage.setItem('quizTitle', validation.quizTitle || 'Quiz');
      localStorage.setItem('sessionCode', cleanedCode);
      
      // Detect and store session type (quiz/survey/poll)
      const sessionType = validation.sessionType || 'quiz'; // Default to quiz if not specified
      localStorage.setItem('sessionType', sessionType);
      
      if (validation.quizId) {
        localStorage.setItem('currentQuizId', validation.quizId.toString());
      }
      
      if (validation.surveyId) {
        localStorage.setItem('currentSurveyId', validation.surveyId.toString());
      }
      
      if (validation.pollId) {
        localStorage.setItem('currentPollId', validation.pollId.toString());
      }

      // Step 2: Get employee ID
      let employeeId = '';
      const authUserStr = localStorage.getItem('auth_user');
      
      if (authUserStr) {
        try {
          const authUser = JSON.parse(authUserStr);
          employeeId = authUser.employeeId || authUser.userId || '';
        } catch (e) {
          console.error('Failed to parse auth_user:', e);
        }
      }
      
      if (!employeeId) {
        this.snackBar.open('⚠️ No user session found. Please login first.', 'Close', {
          duration: 5000,
          panelClass: ['participant-snackbar']
        });
        this.router.navigate(['/']);
        return;
      }

      // Step 3: Join session
      const participant = await this.participantService.joinSession({
        sessionCode: cleanedCode,
        nickname: cleanedName,
        employeeId: employeeId
      });

      // Store participant and session data
      localStorage.setItem('participantName', cleanedName);
      localStorage.setItem('participantId', participant.participantId.toString());
      // Always store sessionId for all session types
      if (participant.sessionId) {
        localStorage.setItem('sessionId', participant.sessionId.toString());
      } else if (validation.sessionId) {
        localStorage.setItem('sessionId', validation.sessionId.toString());
      }
      
      // Store session code and type
      localStorage.setItem('sessionCode', cleanedCode);
      localStorage.setItem('sessionType', sessionType);
      
      // Store title
      if (validation.quizTitle) {
        localStorage.setItem('quizTitle', validation.quizTitle);
      }

      // Go directly to countdown/lobby or participant responses based on session type
      const queryParams: any = { code: cleanedCode };
      if (sessionType === 'quiz' && validation.quizId) {
        queryParams.quizId = validation.quizId;
        localStorage.setItem('currentQuizId', validation.quizId.toString());
      } else if (sessionType === 'survey' && validation.surveyId) {
        queryParams.surveyId = validation.surveyId;
        localStorage.setItem('currentSurveyId', validation.surveyId.toString());
      } else if (sessionType === 'poll' && validation.pollId) {
        queryParams.pollId = validation.pollId;
        localStorage.setItem('currentPollId', validation.pollId.toString());
      }
      queryParams.sessionType = sessionType;
      queryParams.participantId = participant.participantId;

      // Redirect to countdown/waiting room for all session types (quiz, survey, poll)
      // The countdown component will handle navigation to the appropriate page when session starts
      console.log('[ParticipantPage] Navigating to countdown with params:', queryParams);
      this.router.navigate(['/countdown'], { queryParams });

    } catch (error: any) {
      const friendlyMessage = this.getJoinErrorMessage(error);
      this.snackBar.open(`⚠️ ${friendlyMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['participant-snackbar']
      });
    } finally {
      this.isJoining = false;
    }
  }

  private getJoinErrorMessage(error: any): string {
    const rawMessage = error?.message || 'Failed to join quiz.';
    const prefix = 'Failed to join session:';
    if (rawMessage.startsWith(prefix)) {
      return rawMessage.replace(prefix, '').trim();
    }
    return rawMessage;
  }

  // Scanner functions - now joins directly when scanned
  toggleScanner(): void {
    this.scannerActive = !this.scannerActive;
    if (!this.scannerActive) {
      console.log('[Scanner] Scanner closed');
    }
  }

  async onCodeScanned(result: string): Promise<void> {
    console.log('[Scanner] QR Code scanned:', result);
    
    if (!result) return;

    this.scannerActive = false;

    // Navigate directly to the scanned URL/content
    setTimeout(() => {
      if (result && result.trim()) {
        // Check if it's a full URL
        if (result.startsWith('http://') || result.startsWith('https://')) {
          window.location.href = result;
        } else if (result.includes('/participantpage')) {
          // Relative path with participantpage
          window.location.href = result;
        } else {
          // Plain code - navigate to participantpage with code param
          window.location.href = `${window.location.origin}/participantpage?code=${result}`;
        }
      }
    }, 300);
  }

  onScanError(error: any): void {
    console.error('[Scanner] Scan error:', error);
  }

  onCamerasFound(cameras: MediaDeviceInfo[]): void {
    this.availableCameras = cameras;
    console.log('[Scanner] Cameras found:', cameras.length);
    
    // Prefer back camera on mobile devices
    const backCamera = cameras.find(camera => 
      camera.label.toLowerCase().includes('back') || 
      camera.label.toLowerCase().includes('rear')
    );
    
    this.selectedCamera = backCamera || cameras[0];
    console.log('[Scanner] Selected camera:', this.selectedCamera?.label);
  }

  onPermissionResponse(hasPermission: boolean): void {
    console.log('[Scanner] Camera permission:', hasPermission);
    if (!hasPermission) {
      this.snackBar.open('📷 Camera permission is required to scan QR codes. Please enable camera access in your browser settings.', 'Close', {
        duration: 6000,
        panelClass: ['participant-snackbar']
      });
      this.scannerActive = false;
    }
  }

  openFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    console.log('[Scanner] File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('⚠️ Please select a valid image file', 'Close', {
        duration: 3000,
        panelClass: ['participant-snackbar']
      });
      input.value = '';
      return;
    }

    try {
      // Create FileReader to read the image
      const reader = new FileReader();
      
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        try {
          const imageDataUrl = e.target?.result as string;
          console.log('[Scanner] Image loaded as data URL');
          
          // Create image element
          const img = new Image();
          
          img.onload = async () => {
            try {
              console.log('[Scanner] Image dimensions:', img.width, 'x', img.height);
              
              // Create QR code reader
              const codeReader = new BrowserQRCodeReader();
              
              // Decode from image URL
              const result = await codeReader.decodeFromImageUrl(imageDataUrl);
              const qrContent = result.getText();
              
              console.log('[Scanner] QR Code successfully decoded:', qrContent);
              
              // Show success message
              this.snackBar.open('✅ QR Code scanned successfully!', 'Close', {
                duration: 2000,
                panelClass: ['participant-snackbar']
              });
              
              // Navigate after short delay
              setTimeout(() => {
                if (qrContent && qrContent.trim()) {
                  // Check if it's a full URL
                  if (qrContent.startsWith('http://') || qrContent.startsWith('https://')) {
                    window.location.href = qrContent;
                  } else if (qrContent.includes('/participantpage')) {
                    // Relative path with participantpage
                    window.location.href = qrContent;
                  } else {
                    // Plain code - navigate to participantpage with code param
                    window.location.href = `${window.location.origin}/participantpage?code=${qrContent}`;
                  }
                }
              }, 500);
              
            } catch (decodeError: any) {
              console.error('[Scanner] Decode error:', decodeError);
              this.snackBar.open('❌ No QR code found in image. Make sure the QR code is clear and fully visible.', 'Close', {
                duration: 5000,
                panelClass: ['participant-snackbar']
              });
            }
          };
          
          img.onerror = (error) => {
            console.error('[Scanner] Image load error:', error);
            this.snackBar.open('❌ Failed to load image. Please try a different file.', 'Close', {
              duration: 5000,
              panelClass: ['participant-snackbar']
            });
          };
          
          img.src = imageDataUrl;
          
        } catch (error: any) {
          console.error('[Scanner] Processing error:', error);
          this.snackBar.open('❌ Failed to process image. Error: ' + error.message, 'Close', {
            duration: 5000,
            panelClass: ['participant-snackbar']
          });
        }
      };
      
      reader.onerror = (error) => {
        console.error('[Scanner] FileReader error:', error);
        this.snackBar.open('❌ Failed to read file. Please try again.', 'Close', {
          duration: 5000,
          panelClass: ['participant-snackbar']
        });
      };
      
      // Read file as data URL
      reader.readAsDataURL(file);
      
    } catch (error: any) {
      console.error('[Scanner] File processing error:', error);
      this.snackBar.open('❌ Failed to process image. Error: ' + error.message, 'Close', {
        duration: 5000,
        panelClass: ['participant-snackbar']
      });
    }
    
    // Reset input
    input.value = '';
  }
}
