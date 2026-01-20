# Robotic Gripper for Emergency Assistance
**Team: Hexa Unit**

## 1. Motivation
- **Critical Gap in Rescue Operations:** 
    - Accidents in confined spaces often prevent human intervention.
    - Lack of affordable, compact robotic tools leads to preventable loss of life.
- **Current Limitations:** 
    - Existing industrial grippers are expensive and complex.

## 2. Project Objective
- Develop a **low-cost, microcontroller-based robotic gripper** that can:
    - Grip and release objects remotely.
    - Operate in hazardous environments.
    - Serve as a foundation for advanced robotic applications.

## 3. Key Features
- **Microcontroller-based Control:** Precise and reliable operation (ESP32).
- **Low-cost & Compact:** Accessible for students and small developers.
- **Gear-driven Mechanism:** Strong torque for secure gripping.
- **Smooth Gripper Action:** Controlled movement for delicate tasks.
- **Portable & Modular:** Flexible for various applications.
- **Pick-and-Place Ready:** Suitable for automation.

## 4. Core Components
### Control & Power
- **Controller:** ESP32 Development Board (WiFi-enabled).
- **Power:** 2×18650 Li-ion Battery pack + LM2596 Buck Converter.
### Actuation & Mechanism
- **Motor:** 12V DC Geared Motor.
- **Motor Driver:** L298N or BTS7960 module.
- **Gripper:** Mechanical claw with articulated arms and gear system.
### Sensors & Feedback
- **Limit Switches:** Detect open/closed positions.
- **Force Sensitive Resistor (FSR):** Prevent over-gripping.
- **Current Sensor (ACS712):** Monitor motor load.

## 5. IoT & Monitoring Features
- **Cloud Platform:** Supabase / Firebase / MQTT for remote management.
- **Dashboard:** React-based smartphone/web interface for real-time control and status.
- **Visual Feedback:** LEDs for power and connection status.

## 6. Implementation Plan
See [implementation_plan.md](file:///C:/Users/STEP/.gemini/antigravity/brain/03b4cffc-1173-4b06-b5b3-20ed1884fef0/implementation_plan.md) for technical details.
