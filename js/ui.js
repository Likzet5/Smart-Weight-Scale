/**
 * UI management for the Strength Training Monitor
 * Handles DOM updates, event binding, and interface state
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
    
    // Force display
    this.currentForceEl = document.getElementById('current-force');
    this.currentForceFill = document.getElementById('current-force-fill');
    this.peakForceEl = document.getElementById('peak-force');
    this.peakForceFill = document.getElementById('peak-force-fill');
    this.forceUnit = document.getElementById('force-unit');
    
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
    this.recordDuration = document.getElementById('record-duration');
    this.targetForce = document.getElementById('target-force');
    this.showTarget = document.getElementById('show-target');
    
    // Chart container
    this.chartContainer = document.getElementById('chart-container');
    
    // Compatibility check
    this.compatibilityCheck = document.getElementById('compatibility-check');
    
    // Check if Web Bluetooth is supported
    if (!navigator.bluetooth) {
      this.compatibilityCheck.classList.remove('hidden');
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
      this.connectionStatus.classList.remove("text-red-600");
      this.connectionStatus.classList.add("text-green-600");
      
      if (deviceName) {
        this.deviceName.textContent = deviceName;
        this.deviceName.classList.remove("hidden");
      }
    } else {
      this.connectionStatus.textContent = "Not Connected";
      this.connectionStatus.classList.remove("text-green-600");
      this.connectionStatus.classList.add("text-red-600");
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
  }
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
    
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
 * Show a success message
 * @param {string} message - Success message to display
 */
  showSuccess(message) {
    this.errorMessage.classList.remove('text-red-500');
    this.errorMessage.classList.add('text-green-500');
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      this.errorMessage.classList.add('hidden');
      this.errorMessage.classList.remove('text-green-500');
      this.errorMessage.classList.add('text-red-500');
    }, 5000);
  }
  /**
   * Get the current settings from the UI
   * @returns {Object} - Settings object
   */
  getSettings() {
    return {
      weightUnit: this.weightUnit.value,
      maxForceRange: parseFloat(this.maxForce.value),
      recordDuration: parseFloat(this.recordDuration.value),
      targetForce: parseFloat(this.targetForce.value),
      showTargetLine: this.showTarget.checked
    };
  }
}
