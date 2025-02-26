/**
 * Data management for the Strength Training Monitor
 * Handles force data storage, unit conversion, and statistics
 */
export class DataManager {
  constructor() {
    // Core data properties
    this.currentForce = 0;
    this.peakForce = 0;
    this.forceHistory = [];
    
    // Recording state
    this.isRecording = false;
    this.recordingStartTime = 0;
    
    // Settings
    this.weightUnit = 'kg'; // Current weight unit
    this.targetForce = 100; // Target force in kg
    this.maxForceRange = 150; // Maximum force to display on gauge
    
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
    return this.recordingStartTime;
  }
  
  /**
   * Stop the current recording session
   */
  stopRecording() {
    this.isRecording = false;
    return this.forceHistory;
  }
  
  /**
   * Add a new force data point to the history
   * @param {number} force - Force value
   * @returns {number} - Time elapsed since recording started (in seconds)
   */
  addForceDataPoint(force) {
    if (!this.isRecording) return 0;
    
    const timeElapsed = (Date.now() - this.recordingStartTime) / 1000;
    this.forceHistory.push({ time: timeElapsed, force });
    return timeElapsed;
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
   * Reset all force data
   */
  reset() {
    this.currentForce = 0;
    this.peakForce = 0;
    this.forceHistory = [];
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
   * Export the force history data as CSV
   * @returns {string} - CSV-formatted string
   */
  exportCsv() {
    if (this.forceHistory.length === 0) return "Time (s),Force (" + this.weightUnit + ")\n";
    
    let csvContent = "Time (s),Force (" + this.weightUnit + ")\n";
    
    for (const point of this.forceHistory) {
      csvContent += `${point.time.toFixed(3)},${point.force.toFixed(2)}\n`;
    }
    
    return csvContent;
  }
}
