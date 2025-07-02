import React, { createContext,  useState } from "react";

// 1. Create the context type
type RoomContextType = {
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  role: string;
  setrole: React.Dispatch<React.SetStateAction<string>>;
};

// 2. Create the context with default value
export const RoomContext = createContext<RoomContextType>({
  roomId: "",
  setRoomId: () => {},
  role: "",
  setrole: () => {},
});

// 3. Create the provider component
export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState<string>("");
  const [role, setrole] = useState<string>("");

  return (
    <RoomContext.Provider value={{ roomId, setRoomId, role, setrole }}>
      {children}
    </RoomContext.Provider>
  );
};