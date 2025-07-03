import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import image from "../assets/image.png";
import zoom from "../assets/zoom.png";
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import Helpers from "@/config/helpers";
import { useNavigate } from "react-router-dom";
import { RoomContext } from "@/context/context"; // Import the context

type Session = {
  time: string;
  date: string;
  title: string;
  meetingId: string;
  user_id?: string; // ✅ (Optional) Added for creator tracking
};

const Dashboard = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionInput, setSessionInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const { setRoomId, setrole } = useContext(RoomContext);

  const user = Helpers.getUserData();
  const userId = user?.id;
  const userName = user?.fullName || user?.name || "User";

  const profileImage = user?.imageUrl
    ? user?.imageUrl.startsWith("http")
      ? user.imageUrl
      : Helpers.baseUrl + user.imageUrl
    : image;

  const generateMeetingId = () => {
    const nums = Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 10)
    );
    return `${nums.slice(0, 3).join("")} ${nums.slice(3, 6).join("")} ${nums
      .slice(6, 10)
      .join("")}`;
  };

  const getTodayString = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${Helpers.apiUrl}room`, {
        headers: {
          Authorization: `Bearer ${Helpers.token}`,
        },
      });
      setSessions(response.data?.rooms || []);
    } catch (error: any) {
      setSessions([]);
      Helpers.toast("error", "Failed to fetch sessions.");
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => {
    setDialogOpen(false);
    setSessionInput("");
  };

  const handleJoin = async () => {
    if (!sessionInput.trim()) return;
    try {
      await axios.post(
        `${Helpers.apiUrl}room`,
        { roomName: sessionInput },
        { headers: { Authorization: `Bearer ${Helpers.token}` } }
      );
      closeDialog();
      fetchSessions(); // Refresh the list after creating
    } catch (error) {
      Helpers.toast("error", "Failed to create session.");
    }
  };

  // Filter sessions by room name (case-insensitive)
  const filteredSessions = sessions.filter((session: any) =>
    session.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 flex flex-col gap-6">
      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Start New Session</DialogTitle>
          </DialogHeader>
          <Input
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            placeholder="Enter session name"
            className="mb-4"
          />
          <DialogFooter className="flex flex-row gap-2 justify-between">
            <Button variant="outline" onClick={closeDialog} className="w-1/2">
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              className="w-1/2 bg-blue-700 text-white hover:bg-blue-800"
            >
              create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative">
        <div
          className="flex items-center gap-3 md:static fixed right-4 top-4 md:right-auto md:top-auto z-10 md:order-none order-2 w-max bg-white md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shadow md:shadow-none"
          style={{ maxWidth: "90vw" }}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold text-xl border-2 border-white shadow-md">
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div className="truncate">
            <div className="text-gray-500 text-sm flex items-center gap-1">
              {getGreeting()} <span className="text-lg">👋</span>
            </div>
            <div className="font-semibold text-gray-800 leading-tight truncate">
              {userName}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center gap-3 max-w-md ml-auto md:order-none order-1 mt-20 md:mt-0">
          <Input
            className="bg-gray-100 border-none focus:ring-2 focus:ring-blue-400 text-gray-700 placeholder:text-gray-400"
            placeholder="Search room name"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200">
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11c0-3.07-1.64-5.64-5-5.958V4a1 1 0 1 0-2 0v1.042C6.64 5.36 5 7.929 5 11v3.159c0 .538-.214 1.055-.595 1.436L3 17h5m7 0a3 3 0 0 1-6 0m6 0H9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Start New Session Card */}
      <div
        className="rounded-2xl bg-gradient-to-r from-blue-500 to-blue-800 p-6 flex items-center justify-center gap-4 shadow-md cursor-pointer"
        onClick={openDialog}
      >
        <div className="flex items-center gap-3">
          <span className="bg-white bg-opacity-20 p-4 flex items-center justify-center rounded-2xl">
            <img src={zoom} alt="Zoom" className="w-8 h-8" />
          </span>
          <span className="text-white text-lg font-semibold">
            Start New Session
          </span>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-xl p-0 md:p-4 shadow-sm flex-1 flex flex-col relative">
        <div className="flex items-center justify-between px-4 pt-4 md:px-0 md:pt-0">
          <div className="font-semibold text-lg text-gray-800">Sessions</div>
          <button className="text-blue-700 font-medium hover:underline text-sm">
            See All
          </button>
        </div>

        <div className="divide-y divide-gray-100 mt-2">
          {loading ? (
            <div className="p-4 text-gray-500">Loading sessions...</div>
          ) : sessions.length > 0 ? (
            filteredSessions.map((session: any, idx: number) => {
              const isSpeaker = session.user_id === userId;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2 md:px-6 py-6 group border-b border-gray-100 last:border-b-0 bg-white hover:bg-gray-50 transition-colors"
                >
                  {/* Time (optional) */}
                  <div className="text-left w-16 md:w-20 text-gray-400 text-base font-medium flex-shrink-0">
                    {/* Optional: {session.time} */}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 font-medium mb-1">
                      {session.date}
                    </div>

                    {/* Room Name (was session.title, now session.name) */}
                    <div className="text-lg md:text-xl font-semibold text-gray-900 leading-tight mb-1">
                      {session.name}
                    </div>

                    <div className="text-xs text-gray-400">
                      Meeting ID: {session.meetingId || session.sid}
                    </div>

                    {/* ✅ Role display based on user_id */}
                    <div className="text-xs text-blue-700 font-semibold mt-1">
                      {isSpeaker ? "Creator" : "Listener"}
                    </div>
                  </div>

                  {/* Join Button */}
                  <div className="flex items-center ml-4">
                    <Button
                      variant="outline"
                      className="border-blue-700 text-blue-700 hover:bg-blue-50 px-8 py-1.5 rounded-lg text-base font-medium transition-all shadow-none group-hover:border-blue-800 group-hover:text-blue-800"
                      onClick={() => {
                        navigate("/languageselector"),
                          setRoomId(session.sid || session.roomId || session.meetingId);
                        setrole(isSpeaker ? "creator" : "listener");
                      }}
                    >
                      Join
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-gray-400">No sessions found.</div>
          )}
        </div>

        {/* Floating Button */}
        <button
          className="fixed md:absolute bottom-8 right-8 md:bottom-6 md:right-6 bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-blue-800 transition-all text-3xl z-20"
          onClick={openDialog}
        >
          <span className="pb-1">+</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
