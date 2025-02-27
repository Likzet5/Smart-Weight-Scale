/**
 * Data management for the Strength Training Monitor
 * Handles force data storage, unit conversion, and statistics
 * Enhanced with RFD (Rate of Force Development) calculations
 */
export class DataManager {
  constructor() {
    // Core data properties
    this.currentForce = 0;
    this.peakForce = 0;
    this.forceHistory = [];
    
    // RFD properties
    this.currentRFD = 0;
    this.peakRFD = 0;
    this.rfdHistory = [];
    this.rfdWindow = 0.1; // Time window in seconds for RFD calculation (100ms)
    this.rfdSmoothingFactor = 0.3; // Smoothing factor for RFD values
    
    // Recording state
    this.isRecording = false;
    this.recordingStartTime = 0;
    
    // Settings
    this.weightUnit = 'kg'; // Current weight unit
    this.targetForce = 100; // Target force in kg
    this.maxForceRange = 150; // Maximum force to display on gauge
    this.maxRFDRange = 1000; // Maximum RFD to display (kg/s)
    
    // Conversion factors
    this.conversionFactors = {
      kgToLbs: 2.20462,
      kgToN: 9.80665,
      lbsToKg: 0.453592,
      lbsToN: 4.44822,
      nToKg: 0.101972,
      nToLbs: 0.224809
    };
  }
  
  /**
   * Start a new recording session
   */
  startRecording() {
    this.recordingStartTime = Date.now();
    this.isRecording = true;
    this.forceHistory = [];
    this.rfdHistory = [];
    this.peakRFD = 0;
    return this.recordingStartTime;
  }
  
  /**
   * Stop the current recording session
   */
  stopRecording() {
    this.isRecording = false;
    return { forceHistory: this.forceHistory, rfdHistory: this.rfdHistory };
  }
  
  /**
   * Add a new force data point to the history and calculate RFD
   * @param {number} force - Force value
   * @returns {number} - Time elapsed since recording started (in seconds)
   */
  addForceDataPoint(force) {
    if (!this.isRecording) return 0;
    
    const timeElapsed = (Date.now() - this.recordingStartTime) / 1000;
    
    // Add force point to history
    this.forceHistory.push({ time: timeElapsed, force });
    
    // Calculate RFD (Rate of Force Development)
    this._calculateRFD(timeElapsed, force);
    
    return timeElapsed;
  }
  
  /**
   * Calculate Rate of Force Development
   * @param {number} currentTime - Current time in seconds
   * @param {number} currentForce - Current force value
   * @private
   */
  _calculateRFD(currentTime, currentForce) {
    // Need at least 2 data points for RFD calculation
    if (this.forceHistory.length < 2) {
      this.rfdHistory.push({ time: currentTime, rfd: 0 });
      this.currentRFD = 0;
      return;
    }
    
    // Method 1: Instantaneous RFD using finite difference with window
    // Find data points within the RFD time window
    const recentPoints = [];
    for (let i = this.forceHistory.length - 1; i >= 0; i--) {
      const point = this.forceHistory[i];
      if (currentTime - point.time <= this.rfdWindow) {
        recentPoints.push(point);
      } else {
        break;
      }
    }
    
    // Need at least 2 points in the window
    if (recentPoints.length < 2) {
      const prevPoint = this.forceHistory[this.forceHistory.length - 2];
      // Simple two-point RFD if we don't have enough points in the time window
      const deltaForce = currentForce - prevPoint.force;
      const deltaTime = currentTime - prevPoint.time;
      
      // Avoid division by zero
      const rfd = deltaTime > 0 ? deltaForce / deltaTime : 0;
      this.currentRFD = rfd;
    } else {
      // Sort by time (oldest first)
      recentPoints.sort((a, b) => a.time - b.time);
      
      // Linear regression to find slope (RFD)
      const n = recentPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      
      for (const point of recentPoints) {
        sumX += point.time;
        sumY += point.force;
        sumXY += point.time * point.force;
        sumXX += point.time * point.time;
      }
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      this.currentRFD = slope; // This is our RFD value
    }
    
    // Apply noise filtering - simple low-pass filter
    if (this.rfdHistory.length > 0) {
      const prevRFD = this.rfdHistory[this.rfdHistory.length - 1].rfd;
      const alpha = this.rfdSmoothingFactor; // Smoothing factor (0-1), lower means more smoothing
      this.currentRFD = alpha * this.currentRFD + (1 - alpha) * prevRFD;
    }
    
    // Update peak RFD if current is higher
    if (this.currentRFD > this.peakRFD) {
      this.peakRFD = this.currentRFD;
    }
    
    // Add to RFD history
    this.rfdHistory.push({ time: currentTime, rfd: this.currentRFD });
  }
  
  /**
   * Update the current force and peak force values
   * @param {number} force - Current force value
   */
  updateForce(force) {
    this.currentForce = force;
    if (force > this.peakForce) {
      this.peakForce = force;
    }
    return { current: this.currentForce, peak: this.peakForce };
  }
  
  /**
   * Get current RFD and peak RFD values
   * @returns {Object} - RFD values
   */
  getRFDValues() {
    return { current: this.currentRFD, peak: this.peakRFD };
  }
  
  /**
   * Reset all force and RFD data
   */
  reset() {
    this.currentForce = 0;
    this.peakForce = 0;
    this.forceHistory = [];
    this.currentRFD = 0;
    this.peakRFD = 0;
    this.rfdHistory = [];
    return true;
  }
  
  /**
   * Change the weight unit and convert all values
   * @param {string} newUnit - New unit ('kg', 'lbs', or 'N')
   */
  changeUnit(newUnit) {
    if (newUnit === this.weightUnit) return false;
    
    const oldUnit = this.weightUnit;
    
    // Convert current and peak force
    this.currentForce = this.convertValue(this.currentForce, oldUnit, newUnit);
    this.peakForce = this.convertValue(this.peakForce, oldUnit, newUnit);
    this.targetForce = this.convertValue(this.targetForce, oldUnit, newUnit);
    this.maxForceRange = this.convertValue(this.maxForceRange, oldUnit, newUnit);
    
    // Convert force history
    if (this.forceHistory.length > 0) {
      this.forceHistory = this.forceHistory.map(point => ({
        time: point.time,
        force: this.convertValue(point.force, oldUnit, newUnit)
      }));
    }
    
    // Convert RFD values (since they're in force/time, we need to convert the force part)
    this.currentRFD = this.convertValue(this.currentRFD, oldUnit, newUnit);
    this.peakRFD = this.convertValue(this.peakRFD, oldUnit, newUnit);
    this.maxRFDRange = this.convertValue(this.maxRFDRange, oldUnit, newUnit);
    
    // Convert RFD history
    if (this.rfdHistory.length > 0) {
      this.rfdHistory = this.rfdHistory.map(point => ({
        time: point.time,
        rfd: this.convertValue(point.rfd, oldUnit, newUnit)
      }));
    }
    
    // Update current unit
    this.weightUnit = newUnit;
    
    return true;
  }
  
  /**
   * Convert a value from one unit to another
   * @param {number} value - Value to convert
   * @param {string} fromUnit - Original unit ('kg', 'lbs', or 'N')
   * @param {string} toUnit - Target unit ('kg', 'lbs', or 'N')
   * @returns {number} - Converted value
   */
  convertValue(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    
    const { kgToLbs, kgToN, lbsToKg, lbsToN, nToKg, nToLbs } = this.conversionFactors;
    
    if (fromUnit === 'kg' && toUnit === 'lbs') return value * kgToLbs;
    if (fromUnit === 'kg' && toUnit === 'N') return value * kgToN;
    if (fromUnit === 'lbs' && toUnit === 'kg') return value * lbsToKg;
    if (fromUnit === 'lbs' && toUnit === 'N') return value * lbsToN;
    if (fromUnit === 'N' && toUnit === 'kg') return value * nToKg;
    if (fromUnit === 'N' && toUnit === 'lbs') return value * nToLbs;
    
    console.warn(`Unsupported unit conversion: ${fromUnit} to ${toUnit}`);
    return value;
  }
  
  /**
   * Calculate average force over the recording period
   * @returns {number} - Average force value
   */
  getAverageForce() {
    if (this.forceHistory.length === 0) return 0;
    
    const sum = this.forceHistory.reduce((acc, point) => acc + point.force, 0);
    return sum / this.forceHistory.length;
  }
  
  /**
   * Calculate average RFD over the recording period
   * @returns {number} - Average RFD value
   */
  getAverageRFD() {
    if (this.rfdHistory.length === 0) return 0;
    
    const sum = this.rfdHistory.reduce((acc, point) => acc + point.rfd, 0);
    return sum / this.rfdHistory.length;
  }
  
  /**
   * Calculate force impulse (area under the force-time curve)
   * @returns {number} - Impulse value
   */
  getImpulse() {
    if (this.forceHistory.length <= 1) return 0;
    
    let impulse = 0;
    for (let i = 1; i < this.forceHistory.length; i++) {
      const dt = this.forceHistory[i].time - this.forceHistory[i-1].time;
      const avgForce = (this.forceHistory[i].force + this.forceHistory[i-1].force) / 2;
      impulse += avgForce * dt;
    }
    
    return impulse;
  }
  
  /**
   * Get time to peak force
   * @returns {number} - Time to peak force in seconds
   */
  getTimeToPeak() {
    if (this.forceHistory.length === 0) return 0;
    
    let maxForce = 0;
    let maxForceTime = 0;
    
    for (const point of this.forceHistory) {
      if (point.force > maxForce) {
        maxForce = point.force;
        maxForceTime = point.time;
      }
    }
    
    return maxForceTime;
  }
  
  /**
   * Get time to peak RFD
   * @returns {number} - Time to peak RFD in seconds
   */
  getTimeToPeakRFD() {
    if (this.rfdHistory.length === 0) return 0;
    
    let maxRFD = 0;
    let maxRFDTime = 0;
    
    for (const point of this.rfdHistory) {
      if (point.rfd > maxRFD) {
        maxRFD = point.rfd;
        maxRFDTime = point.time;
      }
    }
    
    return maxRFDTime;
  }
  
  /**
   * Export the force and RFD history data as CSV
   * @returns {string} - CSV-formatted string
   */
  exportCsv() {
    if (this.forceHistory.length === 0) {
      return `Time (s),Force (${this.weightUnit}),RFD (${this.weightUnit}/s)\n`;
    }
    
    let csvContent = `Time (s),Force (${this.weightUnit}),RFD (${this.weightUnit}/s)\n`;
    
    // Combine force and RFD data by time
    const dataMap = new Map();
    
    // Add force data to map
    for (const point of this.forceHistory) {
      dataMap.set(point.time, { time: point.time, force: point.force, rfd: 0 });
    }
    
    // Add RFD data to map
    for (const point of this.rfdHistory) {
      if (dataMap.has(point.time)) {
        const data = dataMap.get(point.time);
        data.rfd = point.rfd;
      } else {
        dataMap.set(point.time, { time: point.time, force: 0, rfd: point.rfd });
      }
    }
    
    // Sort by time and build CSV
    const sortedData = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
    
    for (const point of sortedData) {
      csvContent += `${point.time.toFixed(3)},${point.force.toFixed(2)},${point.rfd.toFixed(2)}\n`;
    }
    
    return csvContent;
  }
  
  /**
   * Get RFD at a specific percentile of peak force
   * @param {number} forcePercentile - Force percentile (0-1)
   * @returns {number} - RFD value at that force percentile
   */
  getRFDAtForcePercentile(forcePercentile) {
    if (this.forceHistory.length === 0 || this.rfdHistory.length === 0) return 0;
    
    // Find peak force
    const peakForce = Math.max(...this.forceHistory.map(p => p.force));
    
    // Calculate target force
    const targetForce = peakForce * forcePercentile;
    
    // Find closest force point
    let closestPoint = null;
    let minDiff = Infinity;
    
    for (const point of this.forceHistory) {
      const diff = Math.abs(point.force - targetForce);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }
    
    if (!closestPoint) return 0;
    
    // Find RFD at that time
    const targetTime = closestPoint.time;
    let closestRFDPoint = null;
    minDiff = Infinity;
    
    for (const point of this.rfdHistory) {
      const diff = Math.abs(point.time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestRFDPoint = point;
      }
    }
    
    return closestRFDPoint ? closestRFDPoint.rfd : 0;
  }
}
