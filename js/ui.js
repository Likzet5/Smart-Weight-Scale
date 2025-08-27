/**
 * UI management for the Strength Training Monitor
 * Handles DOM updates, event binding, and interface state
 * Enhanced with RFD (Rate of Force Development) support
 * Mobile-optimized
 */ 
export class UI {
  constructor() {
    // Initialize UI elements references
    this._initializeElements();
    
    // Initialize UI state
    this.connected = false;
    this.recording = false;
    this.demoMode = false;
    
    // Track mobile state
    this.isMobile = window.innerWidth < 768;
    
    // Chart performance optimization
    this.chart = null; // Reference to the chart instance
    this.chartDataBuffer = [];
    this.isChartUpdateScheduled = false;
    this.CHART_UPDATE_INTERVAL_MS = 100; // 10fps update rate is plenty for live view
    this.messageTimeout = null; // For auto-hiding messages

    // Add window resize listener
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth < 768;
      
      // Only update if mobile state changed
      if (wasMobile !== this.isMobile) {
        this._updateMetricVisibility();
      }
    });
  }

  /**
   * Sets the chart instance for batched updates.
   * @param {object} chartInstance - The chart instance (e.g., from Chart.js)
   */
  setChart(chartInstance) {
    this.chart = chartInstance;
  }

  /**
   * Clears all data from the chart and the internal buffer.
   */
  resetChart() {
    if (!this.chart || !this.chart.data || typeof this.chart.update !== 'function') return;

    // Clear the buffer
    this.chartDataBuffer.length = 0;

    // Clear the chart's data arrays
    this.chart.data.labels = [];
    this.chart.data.datasets.forEach((dataset) => {
        dataset.data = [];
    });
    this.chart.update('none');
  }
  
  /**
   * Initialize references to DOM elements
   * @private
   */
  _initializeElements() {
    // Connection panel - Desktop
    this.connectBtn = document.getElementById('connect-button');
    this.disconnectBtn = document.getElementById('disconnect-button');
    this.connectionStatus = document.getElementById('connection-status');
    this.deviceName = document.getElementById('device-name');
    this.errorMessage = document.getElementById('error-message');
    this.connectionIndicator = document.getElementById('connection-indicator');
    
    // Connection panel - Mobile
    this.mobileConnectBtn = document.getElementById('mobile-connect-button');
    this.mobileDisconnectBtn = document.getElementById('mobile-disconnect-button');
    this.mobileDemoBtn = document.getElementById('mobile-demo-button');
    this.mobileConnectionStatus = document.getElementById('mobile-connection-status');
    this.mobileConnectionIndicator = document.getElementById('mobile-connection-indicator');
    
    // Demo mode button (needs to be initialized before it's referenced by mobile sync)
    this.demoBtn = document.getElementById('demo-button');

    // Sync desktop/mobile buttons
    if (this.mobileConnectBtn) {
      this.mobileConnectBtn.addEventListener('click', () => {
        if (this.connectBtn) this.connectBtn.click();
      });
    }
    
    if (this.mobileDisconnectBtn) {
      this.mobileDisconnectBtn.addEventListener('click', () => {
        if (this.disconnectBtn) this.disconnectBtn.click();
      });
    }
    
    if (this.mobileDemoBtn) {
      this.mobileDemoBtn.addEventListener('click', () => {
        if (this.demoBtn) this.demoBtn.click(); // This now works correctly
      });
    }
    
    // Calibration
    this.tareBtn = document.getElementById('tare-button');
    this.calibrationWeightInput = document.getElementById('calibration-weight');
    this.calibrateBtn = document.getElementById('calibrate-button');
    
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
    
    // Settings panel
    this.weightUnit = document.getElementById('weight-unit');
    this.maxForce = document.getElementById('max-force');
    this.maxRFD = document.getElementById('max-rfd');
    this.recordDuration = document.getElementById('record-duration');
    this.targetForce = document.getElementById('target-force');
    this.targetRFD = document.getElementById('target-rfd');
    this.showTarget = document.getElementById('show-target');
    this.showRFDTarget = document.getElementById('show-rfd-target');
    
    // Tab interface handling
    this.generalTabBtn = document.getElementById('general-tab-btn');
    this.displayTabBtn = document.getElementById('display-tab-btn');
    this.calibrationTabBtn = document.getElementById('calibration-tab-btn');
    this.generalSettingsTab = document.getElementById('general-settings-tab');
    this.displayTab = document.getElementById('display-tab');
    this.calibrationTab = document.getElementById('calibration-tab');

    // Set up tab switching logic
    this._setupTabSwitching();
    
    // Display toggles
    this.showForceLine = document.getElementById('show-force-line');
    this.showRFDLine = document.getElementById('show-rfd-line');
    
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
   * Sets up the event listeners for the settings tabs in a generic way.
   * @private
   */
  _setupTabSwitching() {
    const tabs = [
      { btn: this.generalTabBtn, panel: this.generalSettingsTab },
      { btn: this.displayTabBtn, panel: this.displayTab },
      { btn: this.calibrationTabBtn, panel: this.calibrationTab }
    ];

    const allBtns = tabs.map(t => t.btn);
    const allPanels = tabs.map(t => t.panel);

    tabs.forEach(activeTab => {
      if (!activeTab.btn) return; // Skip if a button isn't found

      activeTab.btn.addEventListener('click', () => {
        // Hide all panels and deactivate all buttons
        allPanels.forEach(panel => panel && panel.classList.add('hidden'));
        allBtns.forEach(btn => {
          if (!btn) return;
          btn.classList.remove('text-blue-600', 'border-blue-600');
          btn.classList.add('text-gray-500', 'border-transparent');
        });

        // Show the active panel and activate its button
        if (activeTab.panel) activeTab.panel.classList.remove('hidden');
        activeTab.btn.classList.add('text-blue-600', 'border-blue-600');
        activeTab.btn.classList.remove('text-gray-500', 'border-transparent');
      });
    });
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
      // If both are visible, use grid layout (on non-mobile screens)
      container.className = this.isMobile ? 'mb-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4';
      
      // Handle margins differently on mobile vs desktop when both are visible
      if (this.isMobile) {
        this.forceSection.classList.add('mb-4');
        this.rfdSection.classList.add('mb-4');
      } else {
        // Remove the bottom margin from sections when in grid
        this.forceSection.classList.remove('mb-4');
        this.rfdSection.classList.remove('mb-4');
      }
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

    const statusElements = [
      { status: this.connectionStatus, indicator: this.connectionIndicator },
      { status: this.mobileConnectionStatus, indicator: this.mobileConnectionIndicator }
    ];

    statusElements.forEach(({ status, indicator }) => {
      if (status) status.textContent = connected ? "Connected" : "Not Connected";
      if (indicator) {
        indicator.classList.toggle("bg-red-500", !connected);
        indicator.classList.toggle("bg-green-500", connected);
      }
    });

    if (deviceName && this.deviceName) {
      this.deviceName.textContent = deviceName;
      this.deviceName.classList.toggle("hidden", !connected);
    }

    // Update button states
    this.updateButtonStates();
  }
  
  /**
   * Update the demo mode status
   * @param {boolean} enabled - Is demo mode enabled
   */
  updateDemoStatus(enabled) {
    this.demoMode = enabled;

    const demoButtons = [this.demoBtn, this.mobileDemoBtn];
    demoButtons.forEach(btn => {
      if (btn) {
        btn.textContent = enabled ? "Stop Demo" : "Demo";
        btn.classList.toggle("bg-purple-600", !enabled);
        btn.classList.toggle("hover:bg-purple-700", !enabled);
        btn.classList.toggle("bg-red-600", enabled);
        btn.classList.toggle("hover:bg-red-700", enabled);
      }
    });

    // Update status indicators
    if (enabled) {
      const statusDisplays = [
        { status: this.connectionStatus, indicator: this.connectionIndicator },
        { status: this.mobileConnectionStatus, indicator: this.mobileConnectionIndicator }
      ];

      for (const display of statusDisplays) {
        if (display.status) display.status.textContent = "Demo Mode";
        if (display.indicator) {
          display.indicator.classList.remove("bg-red-500");
          display.indicator.classList.add("bg-green-500");
        }
      }
    } else {
      // When demo mode is turned off, revert to the actual connection status.
      this.updateConnectionStatus(this.connected);
    }
    
    this.updateButtonStates();
  }
  
  /**
   * Update recording status in the UI
   * @param {boolean} recording - Is recording
   */
  updateRecordingStatus(recording) {
    // If recording is stopping, flush any remaining data to the chart to ensure it's all visible
    if (this.recording && !recording) {
      this.flushChartData();
    }

    this.recording = recording;
    
    if (this.recordingIndicator) {
      this.recordingIndicator.classList.toggle("hidden", !recording);
    }
    
    this.updateButtonStates();
  }

  /**
   * Adds a data point to the chart buffer and schedules a batched update.
   * This should be called for every new data point during recording.
   * @param {object} dataPoint - The data point to add, e.g., { timestamp, force, rfd }
   */
  addChartDataPoint(dataPoint) {
    if (!this.chart || !this.recording) return;

    this.chartDataBuffer.push(dataPoint);

    if (!this.isChartUpdateScheduled) {
      this.isChartUpdateScheduled = true;
      setTimeout(() => this._updateChartFromBuffer(), this.CHART_UPDATE_INTERVAL_MS);
    }
  }

  /**
   * Forces an immediate update of the chart with any remaining data in the buffer.
   * Ensures all data is rendered, especially at the end of a recording session.
   */
  flushChartData() {
    this._updateChartFromBuffer();

    // After the final flush, do a full-detail render.
    // For Chart.js, a simple update is often enough to redraw with default animations.
    if (this.chart && typeof this.chart.update === 'function') {
      this.chart.update();
    }
  }

  /**
   * Processes the data buffer and updates the chart with all points in the buffer.
   * @private
   */
  _updateChartFromBuffer() {
    if (!this.chart || !this.chart.data || typeof this.chart.update !== 'function' || this.chartDataBuffer.length === 0) {
      this.isChartUpdateScheduled = false;
      return;
    }

    // NOTE: This assumes a Chart.js structure and that dataset 0 is force, dataset 1 is RFD.
    // Adjust if your chart setup is different.
    for (const point of this.chartDataBuffer) {
        this.chart.data.labels.push(point.timestamp.toFixed(2));
        this.chart.data.datasets[0].data.push(point.force);
        this.chart.data.datasets[1].data.push(point.rfd);
      }
    this.chartDataBuffer.length = 0; // Clear the buffer
    this.chart.update('none'); // Update chart without animation for performance
    this.isChartUpdateScheduled = false; // Allow the next update to be scheduled
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
   * Shows a message to the user, with appropriate styling for success or error.
   * @param {string} message - The message to display.
   * @param {boolean} isError - If true, styles the message as an error.
   * @private
   */
  _showMessage(message, isError = false) {
    if (!this.errorMessage) return;

    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
    
    // Add a background color to distinguish success from error.
    this.errorMessage.classList.add(isError ? 'bg-red-500' : 'bg-green-500', 'text-white');
    
    // Auto-hide after 5 seconds, clearing any previous timer.
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.errorMessage.classList.add('hidden');
    }, 5000);
  }

  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this._showMessage(message, true);
  }
  
  /**
   * Show a success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    this._showMessage(message, false);
  }
  
  /**
   * Update all button states based on current application state
   */
  updateButtonStates() {
    const activeConnection = this.connected || this.demoMode;
    
    // Connection buttons - Desktop
    if (this.connectBtn) this.connectBtn.disabled = activeConnection;
    if (this.disconnectBtn) this.disconnectBtn.disabled = !this.connected;
    
    // Connection buttons - Mobile
    if (this.mobileConnectBtn) this.mobileConnectBtn.disabled = activeConnection;
    if (this.mobileDisconnectBtn) this.mobileDisconnectBtn.disabled = !this.connected;
    
    // Calibration buttons
    if (this.tareBtn) this.tareBtn.disabled = !this.connected || this.recording;
    if (this.calibrateBtn) this.calibrateBtn.disabled = !this.connected || this.recording;
    
    // Recording buttons
    if (this.startRecordingBtn) this.startRecordingBtn.disabled = !activeConnection || this.recording;
    if (this.stopRecordingBtn) this.stopRecordingBtn.disabled = !this.recording;
    if (this.resetDataBtn) this.resetDataBtn.disabled = !activeConnection;
    
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
      rfdWindow: parseFloat(this.rfdWindowInput.value) / 1000, // Convert from ms to seconds
      isMobile: this.isMobile
    };
  }
}