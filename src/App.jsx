import React, { useState, useEffect } from "react";
import mqtt from "precompiled-mqtt";

function App() {
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [broker, setBroker] = useState({
    protocol: "wss://",
    host: "test.broker.thekaspertech.com",
    port: "",
    username: "",
    password: "",
  });

  const [rooms, setRooms] = useState(
    JSON.parse(localStorage.getItem("rooms")) || []
  );

  // 🔹 connect to broker
  const connectClient = () => {
    const { protocol, host, port, username, password } = broker;
    const url = `${protocol}${host}`;
    const options = { username, password, reconnectPeriod: 1000, clean: true };

    const mqttClient = mqtt.connect(url, options);

    mqttClient.on("connect", () => {
      setIsConnected(true);
      console.log("✅ Connected");
    });

    mqttClient.on("error", (err) => {
      console.error("❌ Connection error:", err);
      mqttClient.end();
    });

    setClient(mqttClient);
  };

  // 🔹 publish JSON message
  const sendMessage = (deviceId, topic, data, token) => {
    if (client && isConnected) {
      const fullTopic = `${deviceId}/${topic}`;
      const payload = JSON.stringify({ data, token });
      client.publish(fullTopic, payload);
      console.log("📤 Sent:", payload, "to", fullTopic);
    }
  };

  // 🔹 persist rooms
  const saveRooms = (updated) => {
    setRooms(updated);
    localStorage.setItem("rooms", JSON.stringify(updated));
  };

  // 🔹 add a new room
  const addRoom = () => {
    const name = prompt("Room name?");
    if (!name) return;
    const newRoom = { name, devices: [] };
    saveRooms([...rooms, newRoom]);
  };

  // 🔹 add device to room
  const addDevice = (roomIndex) => {
    const name = prompt("Device name?");
    const id = prompt("Device ID?");
    if (!name || !id) return;
    const newDevice = { name, id, loads: [] };
    const updated = [...rooms];
    updated[roomIndex].devices.push(newDevice);
    saveRooms(updated);
  };

  // 🔹 delete device
  const deleteDevice = (roomIndex, deviceIndex) => {
    const updated = [...rooms];
    updated[roomIndex].devices.splice(deviceIndex, 1);
    saveRooms(updated);
  };

  // 🔹 add load to device
  const addLoad = (roomIndex, deviceIndex) => {
    const name = prompt("Load name? (e.g., Light, Fan)");
    const topic = prompt("MQTT Topic? (without device ID)");
    const type = prompt("Button type? (push/toggle/input/time)");
    const token = prompt("Token?");
    let config = {};

    if (type === "toggle") {
      config = {
        onValue: prompt("Value when ON?"),
        offValue: prompt("Value when OFF?"),
      };
    } else if (type === "push") {
      config = { value: prompt("Value to send on click?") };
    }

    const newLoad = { name, topic, type, token, config };
    const updated = [...rooms];
    updated[roomIndex].devices[deviceIndex].loads.push(newLoad);
    saveRooms(updated);
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>🏠 MQTT Dashboard</h2>

      {!isConnected ? (
        <button onClick={connectClient}>Connect to Broker</button>
      ) : (
        <button onClick={addRoom}>➕ Add Room</button>
      )}

      {rooms.map((room, rIdx) => (
        <div
          key={rIdx}
          style={{ border: "1px solid #ccc", marginTop: 20, padding: 10 }}
        >
          <h3>{room.name}</h3>
          <button onClick={() => addDevice(rIdx)}>➕ Add Device</button>

          {room.devices.map((dev, dIdx) => (
            <div
              key={dIdx}
              style={{
                border: "1px solid #aaa",
                margin: "10px 0",
                padding: 10,
              }}
            >
              <h4>
                {dev.name} (ID: {dev.id})
              </h4>
              <button onClick={() => addLoad(rIdx, dIdx)}>➕ Add Load</button>
              <button
                style={{ marginLeft: 10, color: "red" }}
                onClick={() => deleteDevice(rIdx, dIdx)}
              >
                ❌ Delete Device
              </button>

              {dev.loads.map((load, lIdx) => (
                <div
                  key={lIdx}
                  style={{
                    border: "1px solid #eee",
                    margin: "8px 0",
                    padding: 8,
                  }}
                >
                  <strong>{load.name}</strong> ({load.type}) <br />
                  Topic: {dev.id}/{load.topic}
                  <br />
                  {load.type === "push" && (
                    <button
                      onClick={() =>
                        sendMessage(
                          dev.id,
                          load.topic,
                          load.config.value,
                          load.token
                        )
                      }
                    >
                      {load.config.value}
                    </button>
                  )}
                  {load.type === "toggle" && (
                    <ToggleButton
                      load={load}
                      deviceId={dev.id}
                      sendMessage={sendMessage}
                    />
                  )}
                  {load.type === "input" && (
                    <InputButton
                      load={load}
                      deviceId={dev.id}
                      sendMessage={sendMessage}
                    />
                  )}
                  {load.type === "time" && (
                    <TimeButton
                      load={load}
                      deviceId={dev.id}
                      sendMessage={sendMessage}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// 🔹 Toggle Button
const ToggleButton = ({ load, deviceId, sendMessage }) => {
  const [state, setState] = useState(false);
  const handleClick = () => {
    const value = state ? load.config.offValue : load.config.onValue;
    setState(!state);
    sendMessage(deviceId, load.topic, value, load.token);
  };
  return <button onClick={handleClick}>{state ? "ON" : "OFF"}</button>;
};

// 🔹 Input Button
const InputButton = ({ load, deviceId, sendMessage }) => {
  const [val, setVal] = useState("");
  return (
    <div>
      <input value={val} onChange={(e) => setVal(e.target.value)} />
      <button
        onClick={() => sendMessage(deviceId, load.topic, val, load.token)}
      >
        Send
      </button>
    </div>
  );
};

// 🔹 Time Button
const TimeButton = ({ load, deviceId, sendMessage }) => {
  const [time, setTime] = useState("");
  return (
    <div>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
      />
      <button
        onClick={() => sendMessage(deviceId, load.topic, time, load.token)}
      >
        Send
      </button>
    </div>
  );
};

export default App;
