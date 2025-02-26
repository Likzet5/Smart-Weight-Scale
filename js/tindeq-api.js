/**
 * Tindeq Progressor API Implementation for Web Applications
 * Enhanced with more robust error handling and async/await patterns
 */
export class TindeqDevice {
  // Constants as static properties
  static SERVICE_UUID = "7e4e1701-1ea6-40c9-9dcc-13d34ffead57";
  static DATA_POINT_UUID = "7e4e1702-1ea6-40c9-9dcc-13d34ffead57";
  static CONTROL_POINT_UUID = "7e4e1703-1ea6-40c9-9dcc-13d34ffead57";
  
  // Command opcodes
  static COMMANDS = {
    TARE: 0x64,
    START_MEASUREMENT: 0x65,
    STOP_MEASUREMENT: 0x66,
    CALIBRATE: 0x67,  // Add this line
    SHUTDOWN: 0x6E,
    SAMPLE_BATTERY: 0x6F
  };
  
  // Response codes
  static RESPONSES = {
    BATTERY: 0x00,
    WEIGHT: 0x01,
    LOW_BATTERY: 0x04
  };
  
  constructor() {
    // Device state
    this._device = null;
    this._server = null;
    this._dataCharacteristic = null;
    this._controlCharacteristic = null;
    this._connected = false;
    this._measuring = false;
    
    // Store bound handlers for easier removal
    this._boundDisconnectHandler = this._handleDisconnect.bind(this);
    this._boundNotificationHandler = this._handleDataNotification.bind(this);
    
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
      // Check if already connected
      if (this._connected) {
        console.log("Already connected to a device");
        return true;
      }
      
      console.log("Requesting Bluetooth device...");
      
      // Request the device with Tindeq service UUID
      this._device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [TindeqDevice.SERVICE_UUID] },
          // Also allow devices that advertise with a name to support your Pico
          { namePrefix: "PicoStrength" },
          { namePrefix: "Weight" },
          { namePrefix: "TindeqEmulator" }
        ],
        optionalServices: [TindeqDevice.SERVICE_UUID]
      });
      
      if (!this._device) {
        throw new Error("No device selected");
      }
      
      console.log("Device selected:", this._device.name);
      
      // Set up disconnect listener
      this._device.addEventListener('gattserverdisconnected', this._boundDisconnectHandler);
      
      // Connect to GATT server
      console.log("Connecting to GATT server...");
      this._server = await this._device.gatt.connect();
      
      // Get primary service
      console.log("Getting Tindeq service...");
      const service = await this._server.getPrimaryService(TindeqDevice.SERVICE_UUID);
      
      // Get characteristics
      console.log("Getting characteristics...");
      this._dataCharacteristic = await service.getCharacteristic(TindeqDevice.DATA_POINT_UUID);
      this._controlCharacteristic = await service.getCharacteristic(TindeqDevice.CONTROL_POINT_UUID);
      
      // Start notifications for data
      console.log("Starting notifications...");
      await this._dataCharacteristic.startNotifications();
      this._dataCharacteristic.addEventListener('characteristicvaluechanged', 
          this._boundNotificationHandler);
      
      // Set connected state
      this._connected = true;
      
      // Notify connection change
      if (this.onConnectionChange) {
        this.onConnectionChange(true, this._device.name);
      }
      
      console.log("Connected to Tindeq device:", this._device.name);
      return true;
    } catch (error) {
      console.error("Connection error:", error);
      
      // Clean up any partial connection
      await this._cleanupConnection();
      
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }
  
  /**
   * Clean up connection resources
   * @private
   */
  async _cleanupConnection() {
    try {
      // Stop notifications if available
      if (this._dataCharacteristic) {
        this._dataCharacteristic.removeEventListener(
          'characteristicvaluechanged', 
          this._boundNotificationHandler
        );
        
        try {
          await this._dataCharacteristic.stopNotifications();
        } catch (e) {
          console.warn("Could not stop notifications:", e);
        }
      }
      
      // Disconnect GATT if connected
      if (this._device && this._device.gatt.connected) {
        try {
          this._device.removeEventListener(
            'gattserverdisconnected', 
            this._boundDisconnectHandler
          );
          
          this._device.gatt.disconnect();
        } catch (e) {
          console.warn("Error during GATT disconnect:", e);
        }
      }
      
      // Reset state
      this._server = null;
      this._dataCharacteristic = null;
      this._controlCharacteristic = null;
      this._connected = false;
      this._measuring = false;
    } catch (error) {
      console.warn("Error during connection cleanup:", error);
    }
  }
  
  /**
   * Disconnect from the device
   * @returns {Promise<boolean>} - True if disconnection successful
   */
  async disconnect() {
    try {
      // Stop measurement if active
      if (this._measuring) {
        try {
          await this.stopMeasurement();
        } catch (e) {
          console.warn("Error stopping measurement during disconnect:", e);
        }
      }
      
      await this._cleanupConnection();
      
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
    
    // Clean up resources
    this._server = null;
    this._dataCharacteristic = null;
    this._controlCharacteristic = null;
    this._connected = false;
    this._measuring = false;
    
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
    try {
      const dataView = event.target.value;
      
      // Must have at least one byte for the response code
      if (dataView.byteLength < 1) {
        console.warn("Invalid data notification: too short");
        return;
      }
      
      const responseCode = dataView.getUint8(0);
      console.log(`Received notification with code: 0x${responseCode.toString(16)}, length: ${dataView.byteLength}`);
      
      switch(responseCode) {
        case TindeqDevice.RESPONSES.WEIGHT:
          // Check if it's a batch response (has count byte)
          if (dataView.byteLength >= 2) {
            const count = dataView.getUint8(1);
            console.log(`Batch notification with ${count} samples`);
            
            // Process each sample in the batch
            for (let i = 0; i < count; i++) {
              const offset = 2 + (i * 8); // 8 bytes per sample (4 for float, 4 for uint32)
              
              if (offset + 8 <= dataView.byteLength) {
                const weight = dataView.getFloat32(offset, true);
                const timestamp = dataView.getUint32(offset + 4, true);
                
                console.log(`Sample ${i}: ${weight.toFixed(2)} kg, timestamp: ${timestamp}`);
                
                // Call weight update callback
                if (this.onWeightUpdate) {
                  this.onWeightUpdate(weight, timestamp);
                }
              } else {
                console.warn(`Invalid batch data: offset ${offset} exceeds length ${dataView.byteLength}`);
              }
            }
          } else if (dataView.byteLength >= 9) {
            // Handle legacy single-sample format
            const weight = dataView.getFloat32(1, true);
            const timestamp = dataView.getUint32(5, true);
            
            console.log(`Legacy sample: ${weight.toFixed(2)} kg, timestamp: ${timestamp}`);
            
            if (this.onWeightUpdate) {
              this.onWeightUpdate(weight, timestamp);
            }
          } else {
            console.warn("Invalid weight data format: expected 2+ or 9+ bytes, got", dataView.byteLength);
          }
          break;
        
      case TindeqDevice.RESPONSES.BATTERY:
        // Battery response: code (1) + voltage uint32 (4)
        if (dataView.byteLength >= 5) {
          const batteryMv = dataView.getUint32(1, true);
          
          // Call battery update callback
          if (this.onBatteryUpdate) {
            this.onBatteryUpdate(batteryMv);
          }
        } else {
          console.warn("Invalid battery data format");
        }
        break;
        
      case TindeqDevice.RESPONSES.LOW_BATTERY:
        console.warn("Low battery warning received");
        // Call battery update with 0 to indicate low battery
        if (this.onBatteryUpdate) {
          this.onBatteryUpdate(0);
        }
        break;
        
      default:
        console.warn("Unknown response code:", responseCode);
    }
  }catch (error) {
    console.error("Error handling notification:", error);
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
    if (!this._connected || !this._controlCharacteristic) {
      throw new Error("Device not connected");
    }
    
    try {
      // Simple command without value
      if (value === null) {
        console.log(`Sending command: 0x${opcode.toString(16)}`);
        await this._controlCharacteristic.writeValue(new Uint8Array([opcode]));
        return true;
      }
      
      // Command with value in TLV format
      const valueArray = Array.isArray(value) ? value : [value];
      const commandData = new Uint8Array([opcode, valueArray.length, ...valueArray]);
      console.log(`Sending command: 0x${opcode.toString(16)} with data:`, valueArray);
      await this._controlCharacteristic.writeValue(commandData);
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
    return await this._sendCommand(TindeqDevice.COMMANDS.TARE);
  }
  
  /**
   * Start continuous measurement
   * @returns {Promise<boolean>} - Success status
   */
  async startMeasurement() {
    console.log("Starting measurement");
    const result = await this._sendCommand(TindeqDevice.COMMANDS.START_MEASUREMENT);
    if (result) {
      this._measuring = true;
    }
    return result;
  }
  
  /**
   * Stop measurement
   * @returns {Promise<boolean>} - Success status
   */
  async stopMeasurement() {
    console.log("Stopping measurement");
    const result = await this._sendCommand(TindeqDevice.COMMANDS.STOP_MEASUREMENT);
    if (result) {
      this._measuring = false;
    }
    return result;
  }
  
  /**
   * Request shutdown
   * @returns {Promise<boolean>} - Success status
   */
  async shutdown() {
    console.log("Sending shutdown command");
    return await this._sendCommand(TindeqDevice.COMMANDS.SHUTDOWN);
  }
  
  /**
   * Request battery level
   * @returns {Promise<boolean>} - Success status
   */
  async getBatteryLevel() {
    console.log("Requesting battery level");
    return await this._sendCommand(TindeqDevice.COMMANDS.SAMPLE_BATTERY);
  }
  
  /**
   * Check if device is connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this._connected;
  }
  
  /**
 * Calibrate the scale with a known weight
 * @param {number} knownWeightKg - Weight in kg used for calibration
 * @returns {Promise<boolean>} - Success status
 */
  async calibrate(knownWeightKg) {
    console.log(`Calibrating with weight: ${knownWeightKg} kg`);
    
    // Convert the known weight to a byte array
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, knownWeightKg, true); // true for little-endian
    const weightBytes = new Uint8Array(buffer);
    
    // Send the command with the weight value
    return await this._sendCommand(TindeqDevice.COMMANDS.CALIBRATE, Array.from(weightBytes));
  }

  
  /**
   * Check if device is measuring
   * @returns {boolean} - Measurement status
   */
  isMeasuring() {
    return this._measuring;
  }
}
