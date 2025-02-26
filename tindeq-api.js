/**
 * Tindeq Progressor API Implementation for Web Applications
 * Based on official Tindeq API documentation
 */
class TindeqDevice {
  constructor() {
    // Tindeq Progressor UUIDs (from API documentation)
    this.SERVICE_UUID = "7e4e1701-1ea6-40c9-9dcc-13d34ffead57";
    this.DATA_POINT_UUID = "7e4e1702-1ea6-40c9-9dcc-13d34ffead57";
    this.CONTROL_POINT_UUID = "7e4e1703-1ea6-40c9-9dcc-13d34ffead57";
    
    // Command opcodes
    this.OPCODE_TARE = 0x64;
    this.OPCODE_START_MEASUREMENT = 0x65;
    this.OPCODE_STOP_MEASUREMENT = 0x66;
    this.OPCODE_SHUTDOWN = 0x6E;
    this.OPCODE_SAMPLE_BATTERY = 0x6F;
    
    // Response codes
    this.RESPONSE_BATTERY = 0x00;
    this.RESPONSE_WEIGHT = 0x01;
    this.RESPONSE_LOW_BATTERY = 0x04;
    
    // Device state
    this.device = null;
    this.server = null;
    this.dataCharacteristic = null;
    this.controlCharacteristic = null;
    this.connected = false;
    this.measuring = false;
    
    // Callbacks
    this.onWeightUpdate = null;
    this.onBatteryUpdate = null;
    this.onConnectionChange = null;
    this.onError = null;
  }
  
  /**
   * Connect to a Tindeq device or compatible emulator
   * @returns {Promise<boolean>} - True if connection successful
   */
  async connect() {
    try {
      console.log("Requesting Bluetooth device...");
      
      // Request the device with Tindeq service UUID
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [this.SERVICE_UUID] },
          // Also allow devices that advertise with a name to support your Pico
          { namePrefix: "PicoStrength" },
          { namePrefix: "TindeqEmulator" }
        ],
        optionalServices: [this.SERVICE_UUID]
      });
      
      console.log("Device selected:", this.device.name);
      
      // Set up disconnect listener
      this.device.addEventListener('gattserverdisconnected', this._handleDisconnect.bind(this));
      
      // Connect to GATT server
      console.log("Connecting to GATT server...");
      this.server = await this.device.gatt.connect();
      
      // Get primary service
      console.log("Getting Tindeq service...");
      const service = await this.server.getPrimaryService(this.SERVICE_UUID);
      
      // Get characteristics
      console.log("Getting characteristics...");
      this.dataCharacteristic = await service.getCharacteristic(this.DATA_POINT_UUID);
      this.controlCharacteristic = await service.getCharacteristic(this.CONTROL_POINT_UUID);
      
      // Start notifications for data
      console.log("Starting notifications...");
      await this.dataCharacteristic.startNotifications();
      this.dataCharacteristic.addEventListener('characteristicvaluechanged', 
          this._handleDataNotification.bind(this));
      
      // Set connected state
      this.connected = true;
      
      // Notify connection change
      if (this.onConnectionChange) {
        this.onConnectionChange(true, this.device.name);
      }
      
      console.log("Connected to Tindeq device:", this.device.name);
      return true;
    } catch (error) {
      console.error("Connection error:", error);
      this.connected = false;
      
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }
  
  /**
   * Disconnect from the device
   * @returns {Promise<boolean>} - True if disconnection successful
   */
  async disconnect() {
    try {
      // Stop measurement if active
      if (this.measuring) {
        await this.stopMeasurement();
      }
      
      // Disconnect GATT
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      
      // Reset state
      this.connected = false;
      
      // Notify connection change
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
      
      console.log("Disconnected from Tindeq device");
      return true;
    } catch (error) {
      console.error("Disconnect error:", error);
      
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }
  
  /**
   * Handle GATT disconnection event
   * @private
   */
  _handleDisconnect(event) {
    console.log("Device disconnected");
    this.connected = false;
    this.measuring = false;
    
    // Notify connection change
    if (this.onConnectionChange) {
      this.onConnectionChange(false);
    }
  }
  
  /**
   * Handle data notifications from the device
   * @private
   */
  _handleDataNotification(event) {
    const dataView = event.target.value;
    
    // Must have at least one byte for the response code
    if (dataView.byteLength < 1) {
      console.warn("Invalid data notification: too short");
      return;
    }
    
    const responseCode = dataView.getUint8(0);
    
    switch(responseCode) {
      case this.RESPONSE_WEIGHT:
        // Weight response: code (1) + weight float32 (4) + timestamp uint32 (4)
        if (dataView.byteLength >= 9) {
          const weight = dataView.getFloat32(1, true); // true = little endian
          const timestamp = dataView.getUint32(5, true);
          
          console.log(`Weight: ${weight.toFixed(2)} kg, Timestamp: ${timestamp}`);
          
          // Call weight update callback
          if (this.onWeightUpdate) {
            this.onWeightUpdate(weight, timestamp);
          }
        }
        break;
        
      case this.RESPONSE_BATTERY:
        // Battery response: code (1) + voltage uint32 (4)
        if (dataView.byteLength >= 5) {
          const batteryMv = dataView.getUint32(1, true);
          
          console.log(`Battery: ${batteryMv} mV`);
          
          // Call battery update callback
          if (this.onBatteryUpdate) {
            this.onBatteryUpdate(batteryMv);
          }
        }
        break;
        
      case this.RESPONSE_LOW_BATTERY:
        console.warn("Low battery warning received");
        // Call battery update with 0 to indicate low battery
        if (this.onBatteryUpdate) {
          this.onBatteryUpdate(0);
        }
        break;
        
      default:
        console.warn("Unknown response code:", responseCode);
    }
  }
  
  /**
   * Send a command to the control point
   * @private
   * @param {number} opcode - Command opcode
   * @param {Array|null} value - Optional command value
   * @returns {Promise<boolean>} - Success status
   */
  async _sendCommand(opcode, value = null) {
    if (!this.connected || !this.controlCharacteristic) {
      throw new Error("Device not connected");
    }
    
    try {
      // Simple command without value
      if (value === null) {
        console.log(`Sending command: 0x${opcode.toString(16)}`);
        await this.controlCharacteristic.writeValue(new Uint8Array([opcode]));
        return true;
      }
      
      // Command with value in TLV format
      const valueArray = Array.isArray(value) ? value : [value];
      const commandData = new Uint8Array([opcode, valueArray.length, ...valueArray]);
      console.log(`Sending command: 0x${opcode.toString(16)} with data:`, valueArray);
      await this.controlCharacteristic.writeValue(commandData);
      return true;
    } catch (error) {
      console.error("Error sending command:", error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }
  
  /**
   * Tare the scale (zero calibration)
   * @returns {Promise<boolean>} - Success status
   */
  async tare() {
    console.log("Taring scale");
    return await this._sendCommand(this.OPCODE_TARE);
  }
  
  /**
   * Start continuous measurement
   * @returns {Promise<boolean>} - Success status
   */
  async startMeasurement() {
    console.log("Starting measurement");
    const result = await this._sendCommand(this.OPCODE_START_MEASUREMENT);
    if (result) {
      this.measuring = true;
    }
    return result;
  }
  
  /**
   * Stop measurement
   * @returns {Promise<boolean>} - Success status
   */
  async stopMeasurement() {
    console.log("Stopping measurement");
    const result = await this._sendCommand(this.OPCODE_STOP_MEASUREMENT);
    if (result) {
      this.measuring = false;
    }
    return result;
  }
  
  /**
   * Request shutdown
   * @returns {Promise<boolean>} - Success status
   */
  async shutdown() {
    console.log("Sending shutdown command");
    return await this._sendCommand(this.OPCODE_SHUTDOWN);
  }
  
  /**
   * Request battery level
   * @returns {Promise<boolean>} - Success status
   */
  async getBatteryLevel() {
    console.log("Requesting battery level");
    return await this._sendCommand(this.OPCODE_SAMPLE_BATTERY);
  }
  
  /**
   * Check if device is connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected;
  }
  
  /**
   * Check if device is measuring
   * @returns {boolean} - Measurement status
   */
  isMeasuring() {
    return this.measuring;
  }
}