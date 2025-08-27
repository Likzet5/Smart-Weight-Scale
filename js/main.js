/**
 * Main application for Strength Training Monitor
 * Manages the interaction between UI, data, and device connectivity
 * Enhanced with RFD (Rate of Force Development) support
 */
import { TindeqDevice } from './tindeq-api.js';
import { DataManager } from './data-manager.js';
import { UI } from './ui.js';
import { DualAxisChartRenderer } from './dual-axis-chart-renderer.js';

const HZ_CHECK_INTERVAL_MS = 1000;
const RECORDING_UPDATE_INTERVAL_MS = 100;

class App {
  constructor() {
    // Initialize components
    this.ui = new UI();
    this.data = new DataManager();
    this.device = new TindeqDevice();
    this.chartRenderer = new DualAxisChartRenderer('chart-container');
    // The chart instance is created by the renderer later, so we initialize it as null.
    // It will be passed to the UI component inside _updateChartOptions once it's created.
    this.chart = null;

    // Timers and intervals
    this.isDemoMode = false;
    this.recordingInterval = null;
    
    // Set up event listeners
    this._setupEventListeners();
    this._setupDeviceHandlers();
    
    // Initialize UI and sync settings from the DOM
    this.updateSettings();
    this.ui.updateButtonStates();

    // Monitor the sample rate
    this.sampleCounter = 0;
    this.lastHzCheckTime = Date.now();
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
    
    // Settings changes that trigger a full settings update
    const settingsInputs = [
      this.ui.maxForce, this.ui.maxRFD, this.ui.targetForce,
      this.ui.targetRFD, this.ui.showTarget, this.ui.showRFDTarget,
      this.ui.recordDuration, this.ui.rfdWindowInput
    ];
    
    settingsInputs.forEach(input => {
      if (input) input.addEventListener('change', () => this.updateSettings());
    });

    // Specific setting changes
    if (this.ui.weightUnit) {
      this.ui.weightUnit.addEventListener('change', () => this.changeWeightUnit());
    }
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
      if (now - this.lastHzCheckTime >= HZ_CHECK_INTERVAL_MS) {
        console.log(`Receiving ${this.sampleCounter} samples per second`);
        this.sampleCounter = 0;
        this.lastHzCheckTime = now;
      }
      
      // Update force values
      this._processNewForceValue(weight, this.data.isRecording);
    };
    
    // Error handling
    this.device.onError = (error) => {
      this.ui.showError(error.message || "An error occurred");
    };
  }

  /**
   * Processes a new force value, updating the data model, UI, and chart.
   * This is the central handler for both real and demo data.
   * @param {number} force - The new force value.
   * @param {boolean} isRecording - Whether the app is currently recording.
   * @private
   */
  _processNewForceValue(force, isRecording) {
    // Update live data model and UI displays
    const { current, peak } = this.data.updateForce(force);
    this.ui.updateForceDisplay(current, peak, this.data.maxForceRange);

    if (isRecording) {
      // Add data point to history and get the timestamp
      const timeSeconds = this.data.addForceDataPoint(force);
      
      // Calculate RFD and update its display
      const { current: currentRFD, peak: peakRFD } = this.data.getRFDValues();
      this.ui.updateRFDDisplay(currentRFD, peakRFD, this.data.maxRFDRange);
      
      // Add data to the UI's buffer for batched rendering
      this.ui.addChartDataPoint({
        timestamp: timeSeconds,
        force: force,
        rfd: currentRFD
      });
    }
  }
  
  /**
   * Update chart options based on current settings
   * @private
   */
  _updateChartOptions() {
    const settings = this.ui.getSettings();
    
    // Configure chart options using DataManager as the source of truth for data-related values
    this.chartRenderer.setOptions({
      showForce: settings.showForceLine,
      showRFD: settings.showRFDLine,
      showForceTargetLine: settings.showTargetLine,
      showRFDTargetLine: settings.showRFDTargetLine,
      targetForce: this.data.targetForce,
      targetRFD: this.data.targetRFD,
      unit: this.data.unit,
      maxTime: settings.recordDuration > 0 ? settings.recordDuration : 30, // Default to 30s for visual scaling if unlimited
      maxForce: this.data.maxForceRange,
      maxRFD: this.data.maxRFDRange,
      adaptiveScaling: true, // Always use adaptive scaling
      smoothCurve: true // Use smooth curves for better visualization
    });

    // After setting options, the renderer might create or re-create the chart instance.
    // We must check if the instance has changed and update our references accordingly.
    // This prevents holding a stale reference to a destroyed chart object.
    const newChartInstance = this.chartRenderer.chart;
    if (this.chart !== newChartInstance) {
      this.chart = newChartInstance;
      this.ui.setChart(this.chart);
    }
  }

  /**
   * Updates the main force and RFD displays based on current data.
   * Consolidates UI update calls to avoid duplication.
   * @private
   */
  _updateLiveDisplays() {
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
      // Prepare the data manager for a new recording session.
      // This encapsulates the logic for clearing previous session data.
      this.data.prepareNewRecording();

      // Re-sync chart options before clearing it. This is critical because
      // data model changes (like in prepareNewRecording) can affect axis ranges,
      // and this ensures the chart instance is fresh before we operate on it.
      this._updateChartOptions();

      this._updateLiveDisplays();
      
      // Clear the chart before starting new recording
      this.ui.resetChart(); // Use the UI method to clear chart and buffer
      
      // Start recording in data manager
      this.data.startRecording();
      this.ui.updateRecordingStatus(true);
      
      // Start recording on device (if not in demo mode)
      if (!this.isDemoMode) {
        await this.device.startMeasurement();
      }
      
      // Start timer
      this.recordingInterval = setInterval(() => {
        const elapsed = (Date.now() - this.data.recordingStartTime) / 1000;
        this.ui.updateRecordingTime(elapsed);
        
        // Generate demo data if in demo mode
        if (this.isDemoMode) {
          this._generateDemoData(elapsed);
        }
        
        // Check if we should stop recording based on duration
        const settings = this.ui.getSettings();
        if (settings.recordDuration > 0 && elapsed >= settings.recordDuration) {
          this.stopRecording();
        }
      }, RECORDING_UPDATE_INTERVAL_MS);
    } catch (error) {
      this.ui.showError("Failed to start recording: " + error.message);
    }
  }
  
  /**
   * Stop recording session
   */
  async stopRecording() {
    // Stop the timer first to prevent new data points (especially in demo mode)
    // from arriving while we are trying to stop and finalize the recording.
    // This prevents a potential race condition.
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // Stop the data manager's recording state
    this.data.stopRecording();
    
    // Stop the physical device from sending measurements
    if (!this.isDemoMode && this.device.isConnected()) {
      try {
        await this.device.stopMeasurement();
      } catch (error) {
        this.ui.showError("Failed to stop recording: " + error.message);
      }
    }

    // Now that all data flow has stopped, update the UI.
    // This includes flushing any remaining data to the chart.
    this.ui.updateRecordingStatus(false);
    
    // Calculate and display final statistics from the recorded data.
    this.updateStatistics();
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
    // Using prepareNewRecording() instead of reset() to ensure the application
    // remains in a consistent state for the UI. The reset() method appears to
    // cause an issue where the chart object becomes invalid for subsequent operations.
    this.data.prepareNewRecording();
    
    // Update UI
    this.ui.updateRecordingTime(0);
    this._updateLiveDisplays();
    this.ui.updateForceStats(0, 0, 0);
    this.ui.updateRFDStats(0, 0);
    
    // After a full data reset, the chart must be re-configured to reflect
    // the new state of the data model (e.g., reset axis ranges).
    this._updateChartOptions();

    // Now, clear any lingering data points from the (potentially new) chart instance.
    this.ui.resetChart();
  }
  
  /**
   * Toggle demo mode
   */
  async toggleDemoMode() {
    this.isDemoMode = !this.isDemoMode;
    this.ui.updateDemoStatus(this.isDemoMode);

    // Stop any current activity
    if (this.data.isRecording) {
      await this.stopRecording();
    }

    // If entering demo mode, ensure device is disconnected to avoid conflicts
    if (this.isDemoMode && this.device.isConnected()) {
      await this.disconnectDevice();
    }

    // Reset data to start fresh
    this.resetData();
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
    // Use the user's target force for the demo, but provide a reasonable default
    // if it's not set. This ensures the demo works out-of-the-box.
    const maxTargetForce = settings.targetForce > 0 ? settings.targetForce : 50;
    
    // Bell curve formula with noise
    const bellCurve = Math.exp(-Math.pow((timeSeconds - peakTime) / (maxTime / 5), 2));
    const noise = (Math.random() - 0.5) * (maxTargetForce * 0.05); // Reduced noise
    const force = (maxTargetForce * bellCurve) + noise;
    
    this._processNewForceValue(force, true); // It's always recording in demo mode
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
    this._updateLiveDisplays();

    // Update chart
    // Update chart options with new converted values from the data model
    this._updateChartOptions();
    if (this.chart && typeof this.chart.update === 'function') {
      this.chart.update();
    }

    // Update statistics
    this.updateStatistics();
  }
  
  /**
   * Update settings from UI
   */
  updateSettings() {
    const settings = this.ui.getSettings();
    
    // Update data model. This is the single source for applying UI settings to the data model.
    this.data.targetForce = settings.targetForce;
    this.data.targetRFD = settings.targetRFD;
    this.data.maxForceRange = settings.maxForceRange;
    this.data.maxRFDRange = settings.maxRFDRange;
    this.data.rfdWindow = settings.rfdWindow;
    this.data.rfdSmoothingFactor = 0.3; // Fixed value, could be made configurable
    
    // Update live displays with potentially new max ranges
    this._updateLiveDisplays();

    // Update chart options and redraw
    this._updateChartOptions();
    if (this.chart && typeof this.chart.update === 'function') {
      this.chart.update();
    }
  }
}

// Initialize the app when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
