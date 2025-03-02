/**
 * Main application for Strength Training Monitor
 * Manages the interaction between UI, data, and device connectivity
 * Enhanced with RFD (Rate of Force Development) support
 */
import { TindeqDevice } from './tindeq-api.js';
import { DataManager } from './data-manager.js';
import { UI } from './ui.js';
import { DualAxisChartRenderer } from './dual-axis-chart-renderer.js';

class App {
  constructor() {
    // Initialize components
    this.ui = new UI();
    this.data = new DataManager();
    this.device = new TindeqDevice();
    this.chart = new DualAxisChartRenderer('chart-container');
    
    // Timers and intervals
    this.recordingInterval = null;
    this.demoInterval = null;
    
    // Set up event listeners
    this._setupEventListeners();
    this._setupDeviceHandlers();
    
    // Initialize UI
    this._updateChartOptions();
    this.ui.updateButtonStates();

    // Monitor the sample rate
    this.sampleCounter = 0;
    this.lastHzCheck = Date.now();
  }
  
  /**
   * Set up UI event listeners
   * @private
   */
  _setupEventListeners() {
    // Connection buttons
    this.ui.connectBtn.addEventListener('click', () => this.connectDevice());
    this.ui.disconnectBtn.addEventListener('click', () => this.disconnectDevice());
    this.ui.tareBtn.addEventListener('click', () => this.tareDevice());
    this.ui.calibrateBtn.addEventListener('click', () => this.calibrateDevice());
    
    // Recording buttons
    this.ui.startRecordingBtn.addEventListener('click', () => this.startRecording());
    this.ui.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
    this.ui.resetDataBtn.addEventListener('click', () => this.resetData());
    
    // Demo mode
    this.ui.demoBtn.addEventListener('click', () => this.toggleDemoMode());
    
    // Settings changes
    this.ui.weightUnit.addEventListener('change', () => this.changeWeightUnit());
    this.ui.maxForce.addEventListener('change', () => this.updateSettings());
    this.ui.maxRFD.addEventListener('change', () => this.updateSettings());
    this.ui.targetForce.addEventListener('change', () => this.updateSettings());
    this.ui.targetRFD.addEventListener('change', () => this.updateSettings());
    this.ui.showTarget.addEventListener('change', () => this.updateSettings());
    this.ui.showRFDTarget.addEventListener('change', () => this.updateSettings());
    this.ui.recordDuration.addEventListener('change', () => this.updateSettings());
    this.ui.rfdWindowInput.addEventListener('change', () => this.updateSettings());
  }
  
  /**
   * Set up device event handlers
   * @private
   */
  _setupDeviceHandlers() {
    // Connection status change
    this.device.onConnectionChange = (connected, deviceName) => {
      this.ui.updateConnectionStatus(connected, deviceName);
      
      // Stop recording if device disconnects
      if (!connected && this.data.isRecording) {
        this.stopRecording();
      }
    };
    
    // Weight/force updates
    this.device.onWeightUpdate = (weight, timestamp) => {
      // Count each received sample
      this.sampleCounter++;
      
      // Check if a second has passed
      const now = Date.now();
      if (now - this.lastHzCheck >= 1000) {
        console.log(`Receiving ${this.sampleCounter} samples per second`);
        this.sampleCounter = 0;
        this.lastHzCheck = now;
      }
      
      // Update force values
      const { current, peak } = this.data.updateForce(weight);
      this.ui.updateForceDisplay(
        current, 
        peak, 
        this.data.maxForceRange
      );
      
      // Add to history if recording
      if (this.data.isRecording) {
        const timeSeconds = this.data.addForceDataPoint(weight);
        
        // Get RFD values and update UI
        const { current: currentRFD, peak: peakRFD } = this.data.getRFDValues();
        this.ui.updateRFDDisplay(
          currentRFD,
          peakRFD,
          this.data.maxRFDRange
        );
        
        // Render chart
        this.chart.render(this.data.forceHistory, this.data.rfdHistory);
      }
    };
    
    // Error handling
    this.device.onError = (error) => {
      this.ui.showError(error.message || "An error occurred");
    };
  }
  
  /**
   * Update chart options based on current settings
   * @private
   */
  _updateChartOptions() {
    const settings = this.ui.getSettings();
    
    this.chart.setOptions({
      showForce: settings.showForceLine,
      showRFD: settings.showRFDLine,
      showForceTargetLine: settings.showTargetLine,
      showRFDTargetLine: settings.showRFDTargetLine,
      targetForce: settings.targetForce,
      targetRFD: settings.targetRFD,
      unit: settings.weightUnit,
      maxTime: settings.recordDuration > 0 ? settings.recordDuration : 30, // Default to 30s for visual scaling if unlimited
      maxForce: settings.maxForceRange,
      maxRFD: settings.maxRFDRange,
      adaptiveScaling: true, // Always use adaptive scaling
      smoothCurve: true // Use smooth curves for better visualization
    });
    
    // Update data manager settings
    this.data.targetForce = settings.targetForce;
    this.data.maxForceRange = settings.maxForceRange;
    this.data.maxRFDRange = settings.maxRFDRange;
    this.data.rfdWindow = settings.rfdWindow;
  }
  
  /**
   * Connect to a device
   */
  async connectDevice() {
    try {
      await this.device.connect();
    } catch (error) {
      this.ui.showError("Failed to connect: " + error.message);
    }
  }
  
  /**
   * Disconnect from the current device
   */
  async disconnectDevice() {
    if (this.data.isRecording) {
      await this.stopRecording();
    }
    await this.device.disconnect();
  }
  
  /**
   * Send tare command to the device
   */
  async tareDevice() {
    try {
      await this.device.tare();
    } catch (error) {
      this.ui.showError("Failed to tare: " + error.message);
    }
  }
  
  /**
   * Calibrate the device with a known weight
   */
  async calibrateDevice() {
    try {
      const knownWeight = parseFloat(this.ui.calibrationWeightInput.value);
      if (isNaN(knownWeight) || knownWeight <= 0) {
        this.ui.showError("Please enter a valid weight value greater than zero");
        return;
      }
      
      await this.device.calibrate(knownWeight);
      this.ui.showSuccess(`Calibrated with ${knownWeight} kg`);
    } catch (error) {
      this.ui.showError("Failed to calibrate: " + error.message);
    }
  }
  
  /**
   * Start recording session
   */
  async startRecording() {
    try {
      // Reset peak values and history
      this.data.currentForce = 0;
      this.data.peakForce = 0;
      this.data.forceHistory = [];
      this.data.currentRFD = 0;
      this.data.peakRFD = 0;
      this.data.rfdHistory = [];
        
      this.ui.updateForceDisplay(this.data.currentForce, 0, this.data.maxForceRange);
      this.ui.updateRFDDisplay(this.data.currentRFD, 0, this.data.maxRFDRange);
      
      // Clear the chart before starting new recording
      this.chart.clear();
      
      // Start recording in data manager
      this.data.startRecording();
      this.ui.updateRecordingStatus(true);
      
      // Start recording on device (if not in demo mode)
      if (!this.ui.demoMode) {
        await this.device.startMeasurement();
      }
      
      // Start timer
      this.recordingInterval = setInterval(() => {
        const elapsed = (Date.now() - this.data.recordingStartTime) / 1000;
        this.ui.updateRecordingTime(elapsed);
        
        // Generate demo data if in demo mode
        if (this.ui.demoMode) {
          this._generateDemoData(elapsed);
        }
        
        // Check if we should stop recording based on duration
        const settings = this.ui.getSettings();
        if (settings.recordDuration > 0 && elapsed >= settings.recordDuration) {
          this.stopRecording();
        }
      }, 100);
    } catch (error) {
      this.ui.showError("Failed to start recording: " + error.message);
    }
  }
  
  /**
   * Stop recording session
   */
  async stopRecording() {
    // Update UI
    this.ui.updateRecordingStatus(false);
    
    // Clear recording interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // Stop data recording
    this.data.stopRecording();
    
    // Update statistics
    this.updateStatistics();
    
    // Stop device if not in demo mode
    if (!this.ui.demoMode && this.device.isConnected()) {
      try {
        await this.device.stopMeasurement();
      } catch (error) {
        this.ui.showError("Failed to stop recording: " + error.message);
      }
    }
  }
  
  /**
   * Update statistics after recording
   */
  updateStatistics() {
    // Calculate and update force statistics
    const timeToPeakForce = this.data.getTimeToPeak();
    const avgForce = this.data.getAverageForce();
    const impulse = this.data.getImpulse();
    this.ui.updateForceStats(timeToPeakForce, avgForce, impulse);
    
    // Calculate and update RFD statistics
    const timeToPeakRFD = this.data.getTimeToPeakRFD();
    const avgRFD = this.data.getAverageRFD();
    this.ui.updateRFDStats(timeToPeakRFD, avgRFD);
  }
  
  /**
   * Reset all data
   */
  resetData() {
    // Reset data
    this.data.reset();
    
    // Update UI
    this.ui.updateRecordingTime(0);
    this.ui.updateForceDisplay(0, 0, this.data.maxForceRange);
    this.ui.updateRFDDisplay(0, 0, this.data.maxRFDRange);
    this.ui.updateForceStats(0, 0, 0);
    this.ui.updateRFDStats(0, 0);
    
    // Clear chart
    this.chart.clear();
  }
  
  /**
   * Toggle demo mode
   */
  toggleDemoMode() {
    if (this.ui.demoMode) {
      // Stop demo mode
      this.ui.updateDemoStatus(false);
      
      // Stop any ongoing recording
      if (this.data.isRecording) {
        this.stopRecording();
      }
      
      // Stop demo data generation
      if (this.demoInterval) {
        clearInterval(this.demoInterval);
        this.demoInterval = null;
      }
      
      // Reset data
      this.resetData();
    } else {
      // Start demo mode
      this.ui.updateDemoStatus(true);
      
      // Generate data periodically if not recording
      this.demoInterval = setInterval(() => {
        if (!this.data.isRecording) {
          const randomForce = Math.random() * 20;
          const { current, peak } = this.data.updateForce(randomForce);
          this.ui.updateForceDisplay(current, peak, this.data.maxForceRange);
        }
      }, 200);
    }
  }
  
  /**
   * Generate demo data for the current recording
   * @param {number} timeSeconds - Current recording time in seconds
   * @private
   */
  _generateDemoData(timeSeconds) {
    if (!this.data.isRecording) return;
    
    const settings = this.ui.getSettings();
    const maxTime = settings.recordDuration > 0 ? settings.recordDuration : 30; // If unlimited, use 30s for demo curve
    const peakTime = maxTime / 2;
    const maxTargetForce = settings.targetForce;
    
    // Bell curve formula with noise
    const bellCurve = Math.exp(-Math.pow((timeSeconds - peakTime) / (maxTime / 5), 2));
    const noise = (Math.random() - 0.5) * (maxTargetForce * 0.1);
    const force = maxTargetForce * bellCurve + noise;
    
    // Update data and UI
    const { current, peak } = this.data.updateForce(force);
    this.ui.updateForceDisplay(current, peak, this.data.maxForceRange);
    
    // Add to history and calculate RFD
    this.data.addForceDataPoint(force);
    
    // Get RFD values and update UI
    const { current: currentRFD, peak: peakRFD } = this.data.getRFDValues();
    this.ui.updateRFDDisplay(currentRFD, peakRFD, this.data.maxRFDRange);
    
    // Render chart
    this.chart.render(this.data.forceHistory, this.data.rfdHistory);
  }
  
  /**
   * Change the weight unit used in the app
   */
  changeWeightUnit() {
    const settings = this.ui.getSettings();
    const newUnit = settings.weightUnit;
    
    // Update data model
    this.data.changeUnit(newUnit);
    
    // Update UI
    this.ui.updateUnitDisplay(newUnit);
    this.ui.updateForceDisplay(
      this.data.currentForce, 
      this.data.peakForce, 
      this.data.maxForceRange
    );
    this.ui.updateRFDDisplay(
      this.data.currentRFD,
      this.data.peakRFD,
      this.data.maxRFDRange
    );
    
    // Update chart
    this._updateChartOptions();
    this.chart.render(this.data.forceHistory, this.data.rfdHistory);
    
    // Update statistics
    this.updateStatistics();
  }
  
  /**
   * Update settings from UI
   */
  updateSettings() {
    const settings = this.ui.getSettings();
    
    // Update data model
    this.data.targetForce = settings.targetForce;
    this.data.maxForceRange = settings.maxForceRange;
    this.data.maxRFDRange = settings.maxRFDRange;
    this.data.rfdWindow = settings.rfdWindow;
    this.data.rfdSmoothingFactor = 0.3; // Fixed value, could be made configurable
    
    // Update UI
    this.ui.updateForceDisplay(
      this.data.currentForce, 
      this.data.peakForce, 
      this.data.maxForceRange
    );
    this.ui.updateRFDDisplay(
      this.data.currentRFD,
      this.data.peakRFD,
      this.data.maxRFDRange
    );
    
    // Update chart
    this._updateChartOptions();
    this.chart.render(this.data.forceHistory, this.data.rfdHistory);
  }
}

// Initialize the app when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
