# strength_peripheral.py - BLE peripheral implementation for the Strength Monitor
import bluetooth
import struct
import time
from micropython import const
import config
from ble_advertising import advertising_payload

# Command opcodes
OPCODE_TARE = const(0x64)
OPCODE_START_MEASUREMENT = const(0x65)
OPCODE_STOP_MEASUREMENT = const(0x66)
OPCODE_CALIBRATE = const(0x67)  # New calibration opcode
OPCODE_SHUTDOWN = const(0x6E)
OPCODE_BATTERY = const(0x6F)

# Response codes
RESPONSE_BATTERY = const(0x00)
RESPONSE_WEIGHT = const(0x01)
RESPONSE_LOW_BATTERY = const(0x04)

class StrengthPeripheral:
    """BLE peripheral for strength measurement device"""
    
    def __init__(self, ble, logger, name=None):
        """Initialize the BLE peripheral"""
        self.logger = logger
        self._ble = ble
        self._ble.active(True)
        self._name = name or config.DEVICE_NAME

        # Add these for batching
        self._sample_buffer = []
        self._batch_size = 4  # Send 4 samples at once
        self._last_sync_time = 0
        
        # Define UUIDs
        self._SERVICE_UUID = bluetooth.UUID(config.SERVICE_UUID)
        self._DATA_POINT_UUID = bluetooth.UUID(config.DATA_UUID)
        self._CONTROL_POINT_UUID = bluetooth.UUID(config.CONTROL_UUID)
        
        # Define characteristics
        self._DATA_CHAR = (
            self._DATA_POINT_UUID,
            bluetooth.FLAG_NOTIFY,
        )
        self._CONTROL_CHAR = (
            self._CONTROL_POINT_UUID,
            bluetooth.FLAG_WRITE | bluetooth.FLAG_WRITE_NO_RESPONSE,
        )
        
        # Define service
        self._SERVICE = (
            self._SERVICE_UUID,
            (self._DATA_CHAR, self._CONTROL_CHAR),
        )
        
        # Set up callbacks
        self._tare_callback = None
        self._command_callback = None
        self._weight_callback = None
        self._calibrate_callback = None  # New calibration callback
        
        # State
        self._connections = set()
        self._measuring = False
        self._measurement_start_time = 0 
        
        # Register GATT service and start advertising
        self._init_ble()
    
    def _init_ble(self):
        """Initialize BLE services and advertising"""
        try:
            # Register IRQ handler
            self._ble.irq(self._irq_handler)
            
            # Register GATT services
            self.logger.info("Registering GATT services")
            ((self._handle_data, self._handle_control),) = self._ble.gatts_register_services((self._SERVICE,))
            
            self.logger.info(f"Service registered with handles: Data={self._handle_data}, Control={self._handle_control}")
            
            # Start advertising
            self._advertise()
            
        except Exception as e:
            self.logger.error(f"BLE initialization error: {e}")
            self.logger.error_blink(5)
            raise
    
    def _irq_handler(self, event, data):
        """Handle BLE events"""
        if event == 1:  # _IRQ_CENTRAL_CONNECT
            conn_handle, _, _ = data
            self.logger.info(f"Device connected: {conn_handle}")
            self._connections.add(conn_handle)
            self.logger.blink(2, 50)
            
        elif event == 2:  # _IRQ_CENTRAL_DISCONNECT
            conn_handle, _, _ = data
            if conn_handle in self._connections:
                self._connections.remove(conn_handle)
                self.logger.info(f"Device disconnected: {conn_handle}")
                self._measuring = False
                self._advertise()
            
        elif event == 3:  # _IRQ_GATTS_WRITE
            conn_handle, value_handle = data
            if value_handle == self._handle_control:
                self._handle_command(conn_handle, value_handle)
    
    def _handle_command(self, conn_handle, value_handle):
        """Process commands received on the control characteristic"""
        try:
            value = self._ble.gatts_read(value_handle)
            if not value:
                return
            
            opcode = value[0]
            self.logger.info(f"Command received: 0x{opcode:02x}")
            
            # Handle common commands
            if opcode == OPCODE_TARE:
                self.logger.info("Tare command")
                if self._tare_callback:
                    self._tare_callback()
            
            elif opcode == OPCODE_START_MEASUREMENT:
                self.logger.info("Start measurement command")
                self._measuring = True
                self._measurement_start_time = time.ticks_us()
            
            elif opcode == OPCODE_STOP_MEASUREMENT:
                self.logger.info("Stop measurement command")
                self._measuring = False
                
            elif opcode == OPCODE_CALIBRATE:
                # Handle calibration command
                if len(value) >= 6:  # Needs at least 6 bytes: opcode + length + float32
                    self.logger.info(f"Calibrate command value bytes: {[hex(b) for b in value]}")
                    known_weight = struct.unpack("<f", value[2:6])[0]  # Skip opcode and length bytes
                    self.logger.info(f"Calibrate command with weight: {known_weight} kg")
                    if self._calibrate_callback:
                        self._calibrate_callback(known_weight)
                else:
                    self.logger.warn(f"Calibrate command received with invalid data length: {len(value)}")
            
            # Call general command handler if registered
            if self._command_callback:
                self._command_callback(opcode, value[1:] if len(value) > 1 else None)
                
        except Exception as e:
            self.logger.error(f"Error handling command: {e}")
    
    def _advertise(self):
        """Start BLE advertising"""
        try:
            self.logger.info(f"Starting advertising as '{self._name}'...")
            payload = advertising_payload(name=self._name, services=[self._SERVICE_UUID])
            self._ble.gap_advertise(100000, adv_data=payload)
        except Exception as e:
            self.logger.error(f"Advertising error: {e}")
    
    def send_weight_measurement(self, weight_kg):
        """Send weight measurement to connected devices"""
        if not self.is_connected() or not self.is_measuring():
            return False
            
        try:
            # Calculate time delta
            time_delta = time.ticks_diff(time.ticks_us(), self._measurement_start_time)
            
            # Add to sample buffer
            self._sample_buffer.append((weight_kg, time_delta))
            
            # Send if buffer reaches batch size or 25ms has passed
            current_time = time.ticks_ms()
            if (len(self._sample_buffer) >= self._batch_size or 
                time.ticks_diff(current_time, self._last_sync_time) >= 25):
                
                # Pack multiple samples into one notification
                data = bytearray([RESPONSE_WEIGHT, len(self._sample_buffer)])
                
                for w, t in self._sample_buffer:
                    # Pack each sample: weight (float32) + timestamp (uint32)
                    data.extend(struct.pack("<fi", w, t))
                
                # Send to all connected devices
                for conn in self._connections:
                    self._ble.gatts_notify(conn, self._handle_data, data)
                
                # Reset buffer and update time
                self._sample_buffer = []
                self._last_sync_time = current_time
                
            return True
        except Exception as e:
            self.logger.error(f"Error sending weight: {e}")
            return False
    
    def send_battery_level(self, voltage_mv):
        """Send battery level in millivolts"""
        if not self.is_connected():
            return False
            
        try:
            # Pack data: response code (0x00) + battery voltage (uint32)
            data = struct.pack("<BI", RESPONSE_BATTERY, voltage_mv)
            
            # Send to all connected devices
            for conn in self._connections:
                self._ble.gatts_notify(conn, self._handle_data, data)
                
            return True
        except Exception as e:
            self.logger.error(f"Error sending battery level: {e}")
            return False
    
    def is_connected(self):
        """Check if any central device is connected"""
        return len(self._connections) > 0
    
    def is_measuring(self):
        """Check if currently measuring"""
        return self._measuring
    
    def on_tare(self, callback):
        """Register tare event callback"""
        self._tare_callback = callback
    
    def on_command(self, callback):
        """Register command event callback"""
        self._command_callback = callback
    
    def on_weight(self, callback):
        """Register weight update callback"""
        self._weight_callback = callback
        
    def on_calibrate(self, callback):
        """Register calibration event callback"""
        self._calibrate_callback = callback