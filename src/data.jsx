import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

export default function Home({ user }) {
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // ------------------- CONNECT STRANGER -------------------
  const connectStranger = async () => {
    console.log("Trying to connect stranger...");
    setWaiting(true);

    // Clean only your own inactive rows
    await cleanupInactiveUsers();

    // Check if any other user is waiting
    const { data: waitingUser, error } = await supabase
      .from("matches")
      .select("*")
      .is("room_id", null)
      .neq("sender", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error fetching waiting users:", error);
      return;
    }

    if (waitingUser && waitingUser.length > 0) {
      console.log("Found waiting user:", waitingUser[0].sender);
      const newRoomId = uuidv4();

      // Update waiting user row with new room and mark as joined
      const { error: updateError } = await supabase
        .from("matches")
        .update({ room_id: newRoomId, type: "joined", data: "connected" })
        .eq("id", waitingUser[0].id);

      if (updateError)
        console.error("Error updating waiting user:", updateError);

      // Insert current user into same room
      const { error: insertError } = await supabase.from("matches").insert({
        sender: user.id,
        room_id: newRoomId,
        type: "join",
        data: "connected",
        last_seen: new Date().toISOString(),
      });

      if (insertError)
        console.error("Error inserting current user:", insertError);

      setRoomId(newRoomId);
      setWaiting(false);
      console.log("Room created:", newRoomId);
    } else {
      console.log("No waiting user, adding self as waiting...");
      const { error: insertError } = await supabase.from("matches").insert({
        sender: user.id,
        type: "waiting",
        data: "waiting for stranger",
        room_id: null,
        last_seen: new Date().toISOString(),
      });

      if (insertError)
        console.error("Error inserting waiting user:", insertError);
    }
  };

  // ------------------- CLEANUP INACTIVE USERS -------------------
  const cleanupInactiveUsers = async () => {
    console.log("Running cleanup of inactive users...");
    const cutoff = new Date(Date.now() - 30 * 1000).toISOString();

    const { error } = await supabase
      .from("matches")
      .delete()
      .lt("last_seen", cutoff)
      .eq("sender", user.id);

    if (error) console.error("Cleanup error:", error);
    else
      console.log("Cleanup success for your own inactive rows before:", cutoff);
  };

  // ------------------- HEARTBEAT -------------------
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const { error } = await supabase
        .from("matches")
        .update({ last_seen: new Date().toISOString() })
        .eq("sender", user.id);
      if (error) console.error("Heartbeat error:", error);
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  // ------------------- SUBSCRIBE TO MATCH -------------------
  useEffect(() => {
    const channel = supabase
      .channel("match-listener")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        async (payload) => {
          // Only handle updates that actually assign a room
          if (payload.new.sender === user.id) {
            if (payload.new.room_id && payload.new.room_id !== roomId) {
              setRoomId(payload.new.room_id);
              setWaiting(false);
              console.log("You got matched! Room ID:", payload.new.room_id);
            }
          }

          // If another user joined your waiting room
          if (
            waiting &&
            payload.new.room_id &&
            payload.new.sender !== user.id
          ) {
            const { data, error } = await supabase
              .from("matches")
              .select("room_id")
              .eq("sender", user.id)
              .limit(1);

            if (!error && data?.[0]?.room_id && data[0].room_id !== roomId) {
              setRoomId(data[0].room_id);
              setWaiting(false);
              console.log("Matched after second user joined:", data[0].room_id);
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [waiting, roomId, user.id]);

  // ------------------- LISTEN FOR MESSAGES -------------------
  // ------------------- LISTEN FOR MESSAGES -------------------
  useEffect(() => {
    if (!roomId) return;

    console.log("Fetching old messages for room:", roomId);

    // 1. Fetch all past messages for this room
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        console.log("Loaded messages:", data);
        setMessages(data);
      }
    };

    loadMessages();

    // 2. Subscribe for new messages in this room
    console.log("Subscribing for new room messages...");
    const channel = supabase
      .channel("signals-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("New message received:", payload.new);
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    // 3. Cleanup on leave / room change
    return () => {
      console.log("Unsubscribing signals-listener");
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // ------------------- SEND MESSAGE -------------------
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await supabase.from("signals").insert({
      sender: user.id,
      room_id: roomId,
      type: "message",
      data: newMessage,
    });
    setNewMessage("");
  };

  // ------------------- LEAVE ROOM -------------------
  // ------------------- LEAVE ROOM -------------------
  const leaveRoom = async () => {
    console.log("Leaving room...");

    if (roomId) {
      // 1. Delete the entire room for both users
      const { error: matchError } = await supabase
        .from("matches")
        .delete()
        .eq("room_id", roomId);

      if (matchError) console.error("Error deleting matches:", matchError);

      const { error: signalError } = await supabase
        .from("signals")
        .delete()
        .eq("room_id", roomId);

      if (signalError) console.error("Error deleting signals:", signalError);

      console.log("Room deleted for everyone:", roomId);
    } else {
      // If user was just waiting and never matched
      await supabase.from("matches").delete().eq("sender", user.id);
      console.log("Removed from waiting list");
    }

    // Reset local state
    setRoomId(null);
    setMessages([]);
    setWaiting(false);
  };

  // ------------------- TRACK ROOM EXISTENCE -------------------
  useEffect(() => {
    if (!roomId) return;

    console.log("Tracking room existence:", roomId);

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id")
        .eq("room_id", roomId);

      if (error) {
        console.error("Error checking room existence:", error);
        return;
      }

      if (!data || data.length === 0) {
        console.log("Room no longer exists, resetting UI...");

        setRoomId(null);
        setMessages([]);
        setWaiting(false);
      }
    }, 5000); // check every 5 seconds

    return () => clearInterval(interval);
  }, [roomId]);
  // ------------------- RENDER -------------------
  return (
    <div className="p-6">
      {!roomId ? (
        <div className="text-center">
          <button
            onClick={connectStranger}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Connect Stranger
          </button>
          {waiting && <p>⏳ Waiting for someone to join...</p>}
        </div>
      ) : (
        <div>
          <h2 className="font-bold text-xl mb-2">Room: {roomId}</h2>
          <div className="border p-3 h-64 overflow-y-auto bg-gray-100 mb-3">
            {messages.map((msg, i) => {
              // Format timestamp nicely
              const time = new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={i}
                  className={`p-2 my-1 rounded max-w-xs ${
                    msg.sender === user.id
                      ? "bg-blue-300 ml-auto text-right"
                      : "bg-green-300 mr-auto text-left"
                  }`}
                >
                  <div>{msg.data}</div>
                  <div className="text-xs text-gray-700 mt-1">{time}</div>
                </div>
              );
            })}
          </div>

          <div className="flex">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="border flex-1 p-2"
              placeholder="Type a message..."
            />
            <button
              onClick={sendMessage}
              className="bg-green-500 text-white px-4 py-2 ml-2 rounded"
            >
              Send
            </button>
            <button
              onClick={leaveRoom}
              className="bg-red-500 text-white px-4 py-2 ml-2 rounded"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
