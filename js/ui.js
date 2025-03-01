/**
 * UI management for the Strength Training Monitor
 * Handles DOM updates, event binding, and interface state
 * Enhanced with RFD (Rate of Force Development) support
 */
export class UI {
  constructor() {
    // Initialize UI elements references
    this._initializeElements();
    
    // Initialize UI state
    this.connected = false;
    this.recording = false;
    this.demoMode = false;
  }
  
  /**
   * Initialize references to DOM elements
   * @private
   */
  _initializeElements() {
    // Connection panel
    this.connectBtn = document.getElementById('connect-button');
    this.disconnectBtn = document.getElementById('disconnect-button');
    this.tareBtn = document.getElementById('tare-button');
    this.connectionStatus = document.getElementById('connection-status');
    this.deviceName = document.getElementById('device-name');
    this.errorMessage = document.getElementById('error-message');
    this.calibrationWeightInput = document.getElementById('calibration-weight');
    this.calibrateBtn = document.getElementById('calibrate-button');

    // Add to _initializeElements method in UI class
    this.connectionMenuButton = document.getElementById('connection-menu-button');
    this.connectionMenu = document.getElementById('connection-menu');
    this.connectionIndicator = document.getElementById('connection-indicator');
    // Set up connection menu toggle
    this.connectionMenuButton.addEventListener('click', () => {
      this.connectionMenu.classList.toggle('hidden');
    });  
    // Close the menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!this.connectionMenuButton.contains(event.target) && 
          !this.connectionMenu.contains(event.target)) {
        this.connectionMenu.classList.add('hidden');
      }
    });
    
    // Force display
    this.currentForceEl = document.getElementById('current-force');
    this.currentForceFill = document.getElementById('current-force-fill');
    this.peakForceEl = document.getElementById('peak-force');
    this.peakForceFill = document.getElementById('peak-force-fill');
    this.forceUnit = document.getElementById('force-unit');
    this.forceSection = document.getElementById('force-section');
    this.timeToPeakForce = document.getElementById('time-to-peak-force');
    this.avgForce = document.getElementById('avg-force');
    this.forceImpulse = document.getElementById('force-impulse');
    
    // RFD display
    this.currentRFDEl = document.getElementById('current-rfd');
    this.currentRFDFill = document.getElementById('current-rfd-fill');
    this.peakRFDEl = document.getElementById('peak-rfd');
    this.peakRFDFill = document.getElementById('peak-rfd-fill');
    this.rfdUnit = document.getElementById('rfd-unit');
    this.rfdSection = document.getElementById('rfd-section');
    this.timeToPeakRFD = document.getElementById('time-to-peak-rfd');
    this.avgRFD = document.getElementById('avg-rfd');
    this.rfdWindowInput = document.getElementById('rfd-window');
    this.rfdWindowValue = document.getElementById('rfd-window-value');
    
    // Recording controls
    this.startRecordingBtn = document.getElementById('start-recording');
    this.stopRecordingBtn = document.getElementById('stop-recording');
    this.resetDataBtn = document.getElementById('reset-data');
    this.recordingTime = document.getElementById('recording-time');
    this.recordingIndicator = document.getElementById('recording-indicator');
    
    // Demo mode
    this.demoBtn = document.getElementById('demo-button');
    
    // Settings panel
    this.weightUnit = document.getElementById('weight-unit');
    this.maxForce = document.getElementById('max-force');
    this.maxRFD = document.getElementById('max-rfd');
    this.recordDuration = document.getElementById('record-duration');
    this.targetForce = document.getElementById('target-force');
    this.targetRFD = document.getElementById('target-rfd');
    this.showTarget = document.getElementById('show-target');
    this.showRFDTarget = document.getElementById('show-rfd-target');
    
    // Display toggles
    this.showForceLine = document.getElementById('show-force-line');
    this.showRFDLine = document.getElementById('show-rfd-line');
    this._updateMetricVisibility(); // Initial layout based on checkbox defaults
    
    // Add toggle event listeners
    this.showForceLine.addEventListener('change', () => this._updateMetricVisibility());
    this.showRFDLine.addEventListener('change', () => this._updateMetricVisibility());
    
    // Initialize RFD window slider
    this.rfdWindowInput.addEventListener('input', () => {
      const value = this.rfdWindowInput.value;
      this.rfdWindowValue.textContent = `${value}ms`;
    });
    
    // Chart container
    this.chartContainer = document.getElementById('chart-container');
    
    // Compatibility check
    this.compatibilityCheck = document.getElementById('compatibility-check');
    
    // Check if Web Bluetooth is supported
    if (!navigator.bluetooth) {
      this.compatibilityCheck.classList.remove('hidden');
    }
    
    // Initialize display based on toggle states
    this._updateMetricVisibility();
  }
  
  /**
   * Update metric visibility based on toggle states
   * @private
   */
  _updateMetricVisibility() {
    // Get current toggle states
    const showForce = this.showForceLine.checked;
    const showRFD = this.showRFDLine.checked;
    
    // Update section visibility
    this.forceSection.classList.toggle('section-hidden', !showForce);
    this.rfdSection.classList.toggle('section-hidden', !showRFD);
    
    // Get container element
    const container = document.getElementById('measurements-container');
    
    // Update container layout based on what's visible
    if (showForce && showRFD) {
      // If both are visible, use grid layout
      container.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4';
      
      // Remove the bottom margin from sections when in grid
      this.forceSection.classList.remove('mb-4');
      this.rfdSection.classList.remove('mb-4');
    } else {
      // If only one is visible, use normal layout
      container.className = 'mb-4';
      
      // Re-add the bottom margin to sections when not in grid
      this.forceSection.classList.add('mb-4');
      this.rfdSection.classList.add('mb-4');
    }
  }
  
  /**
   * Update connection status in the UI
   * @param {boolean} connected - Is connected
   * @param {string} deviceName - Name of connected device
   */
  updateConnectionStatus(connected, deviceName = null) {
    this.connected = connected;
    
    if (connected) {
      this.connectionStatus.textContent = "Connected";
      this.connectionIndicator.classList.remove("bg-red-500");
      this.connectionIndicator.classList.add("bg-green-500");
      
      if (deviceName) {
        this.deviceName.textContent = deviceName;
        this.deviceName.classList.remove("hidden");
      }
    } else {
      this.connectionStatus.textContent = "Not Connected";
      this.connectionIndicator.classList.remove("bg-green-500");
      this.connectionIndicator.classList.add("bg-red-500");
      this.deviceName.classList.add("hidden");
    }
    
    this.updateButtonStates();
  }
  
  /**
   * Update the demo mode status
   * @param {boolean} enabled - Is demo mode enabled
   */
  updateDemoStatus(enabled) {
    this.demoMode = enabled;
    
    if (enabled) {
      this.demoBtn.textContent = "Stop Demo Mode";
      this.demoBtn.classList.remove("bg-purple-600", "hover:bg-purple-700");
      this.demoBtn.classList.add("bg-red-600", "hover:bg-red-700");
      
      this.connectionStatus.textContent = "Demo Mode";
      this.connectionStatus.classList.remove("text-red-600");
      this.connectionStatus.classList.add("text-green-600");
    } else {
      this.demoBtn.textContent = "Start Demo Mode";
      this.demoBtn.classList.remove("bg-red-600", "hover:bg-red-700");
      this.demoBtn.classList.add("bg-purple-600", "hover:bg-purple-700");
      
      this.updateConnectionStatus(false);
    }
    
    this.updateButtonStates();
  }
  
  /**
   * Update recording status in the UI
   * @param {boolean} recording - Is recording
   */
  updateRecordingStatus(recording) {
    this.recording = recording;
    
    if (recording) {
      this.recordingIndicator.classList.remove("hidden");
    } else {
      this.recordingIndicator.classList.add("hidden");
    }
    
    this.updateButtonStates();
  }
  
  /**
   * Update the force display gauges and values
   * @param {number} currentForce - Current force value
   * @param {number} peakForce - Peak force value
   * @param {number} maxRange - Maximum force range for gauge
   */
  updateForceDisplay(currentForce, peakForce, maxRange) {
    // Skip if force display is toggled off
    if (!this.showForceLine.checked) return;
    
    // Update text values
    this.currentForceEl.textContent = currentForce.toFixed(1);
    this.peakForceEl.textContent = peakForce.toFixed(1);
    
    // Update gauge fills
    const currentFillPercent = Math.min(100, (currentForce / maxRange) * 100);
    const peakFillPercent = Math.min(100, (peakForce / maxRange) * 100);
    
    this.currentForceFill.style.height = `${currentFillPercent}%`;
    this.peakForceFill.style.height = `${peakFillPercent}%`;
  }
  
  /**
   * Update the RFD display gauges and values
   * @param {number} currentRFD - Current RFD value
   * @param {number} peakRFD - Peak RFD value
   * @param {number} maxRange - Maximum RFD range for gauge
   */
  updateRFDDisplay(currentRFD, peakRFD, maxRange) {
    // Skip if RFD display is toggled off
    if (!this.showRFDLine.checked) return;
    
    // Update text values
    this.currentRFDEl.textContent = currentRFD.toFixed(1);
    this.peakRFDEl.textContent = peakRFD.toFixed(1);
    
    // Update gauge fills
    const currentFillPercent = Math.min(100, (currentRFD / maxRange) * 100);
    const peakFillPercent = Math.min(100, (peakRFD / maxRange) * 100);
    
    this.currentRFDFill.style.height = `${currentFillPercent}%`;
    this.peakRFDFill.style.height = `${peakFillPercent}%`;
  }
  
  /**
   * Update the recording timer display
   * @param {number} seconds - Elapsed seconds
   */
  updateRecordingTime(seconds) {
    this.recordingTime.textContent = seconds.toFixed(1);
  }
  
  /**
   * Update unit display
   * @param {string} unit - Weight unit ('kg', 'lbs', or 'N')
   */
  updateUnitDisplay(unit) {
    this.forceUnit.textContent = unit;
    this.rfdUnit.textContent = unit + '/s';
  }
  
  /**
   * Update force statistics
   * @param {number} timeToPeak - Time to peak force
   * @param {number} avgForce - Average force
   * @param {number} impulse - Force impulse
   */
  updateForceStats(timeToPeak, avgForce, impulse) {
    // Skip if force display is toggled off
    if (!this.showForceLine.checked) return;
    
    this.timeToPeakForce.textContent = timeToPeak.toFixed(1) + 's';
    this.avgForce.textContent = avgForce.toFixed(1) + ' ' + this.forceUnit.textContent;
    this.forceImpulse.textContent = impulse.toFixed(1) + ' ' + this.forceUnit.textContent + '·s';
  }
  
  /**
   * Update RFD statistics
   * @param {number} timeToPeakRFD - Time to peak RFD
   * @param {number} avgRFD - Average RFD
   */
  updateRFDStats(timeToPeakRFD, avgRFD) {
    // Skip if RFD display is toggled off
    if (!this.showRFDLine.checked) return;
    
    this.timeToPeakRFD.textContent = timeToPeakRFD.toFixed(1) + 's';
    this.avgRFD.textContent = avgRFD.toFixed(1) + ' ' + this.rfdUnit.textContent;
  }
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden', 'text-green-500');
    this.errorMessage.classList.add('text-red-500');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      this.errorMessage.classList.add('hidden');
    }, 5000);
  }
  
  /**
   * Show a success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden', 'text-red-500');
    this.errorMessage.classList.add('text-green-500');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      this.errorMessage.classList.add('hidden');
    }, 5000);
  }
  
  /**
   * Update all button states based on current application state
   */
  updateButtonStates() {
    const activeConnection = this.connected || this.demoMode;
    
    // Connection buttons
    this.connectBtn.disabled = activeConnection;
    this.disconnectBtn.disabled = !this.connected;
    this.tareBtn.disabled = !this.connected;
    this.calibrateBtn.disabled = !this.connected || this.recording;
    
    // Recording buttons
    this.startRecordingBtn.disabled = !activeConnection || this.recording;
    this.stopRecordingBtn.disabled = !this.recording;
    this.resetDataBtn.disabled = !activeConnection;
    
    // Apply visual state changes
    const disabledBtns = document.querySelectorAll('button[disabled]');
    disabledBtns.forEach(btn => {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    });
    
    const enabledBtns = document.querySelectorAll('button:not([disabled])');
    enabledBtns.forEach(btn => {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
  }
  
  /**
   * Get the current settings from the UI
   * @returns {Object} - Settings object
   */
  getSettings() {
    return {
      weightUnit: this.weightUnit.value,
      maxForceRange: parseFloat(this.maxForce.value),
      maxRFDRange: parseFloat(this.maxRFD.value),
      recordDuration: parseFloat(this.recordDuration.value),
      targetForce: parseFloat(this.targetForce.value),
      targetRFD: parseFloat(this.targetRFD.value),
      showTargetLine: this.showTarget.checked,
      showRFDTargetLine: this.showRFDTarget.checked,
      showForceLine: this.showForceLine.checked,
      showRFDLine: this.showRFDLine.checked,
      rfdWindow: parseFloat(this.rfdWindowInput.value) / 1000 // Convert from ms to seconds
    };
  }
}
