import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

function Home({ user }) {
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [joinedRoomId, setJoinedRoomId] = useState(null);
  const [userJoined, setUserJoined] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [message, setMessage] = useState([]);
  const [secondUserName, setSecondUserName] = useState("");
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pc = useRef(null);

  useEffect(() => {
    if (!createdRoomId) return;

    let intervalId; // declare here so it's in scope

    const checkJoin = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("room, type, sendername")
        .eq("room", createdRoomId)
        .eq("type", "joined")
        .limit(1);

      if (error) {
        console.log("error in checking same room ", error.message);
        return;
      }

      if (data && data.length > 0) {
        console.log(
          "✅ Someone joined the room, roomId:",
          data[0].room,
          "type:",
          data[0].type,
          "2nd user name : ",
          data[0].sendername
        );

        setSecondUserName(data[0].sendername);

        clearInterval(intervalId); // ✅ now it's defined

        const { error: updateError } = await supabase
          .from("matches")
          .update({ type: "joined" })
          .eq("room", createdRoomId)
          .eq("sender", user.id);

        if (updateError) {
          console.error("error in updating room : ", updateError);
        } else {
          console.log("updated room to joined ");
          setUserJoined(true);
          setJoinedRoomId(createdRoomId);
          console.log("joindedRoomId :", joinedRoomId);
        }
      } else {
        console.log("⏳ No one joined this room yet...");
      }
    };

    intervalId = setInterval(() => {
      console.log("Checking room:", createdRoomId);
      checkJoin();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [createdRoomId]);

  ///////////////////////////////////////// WebRtc Connection ////////////////////////////////////

  useEffect(() => {
    if (!joinedRoomId) return;
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    /// Local  Video Setup ///
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideo.current.srcObject = stream;
        stream
          .getTracks()
          .forEach((track) => pc.current.addTrack(track, stream));
      });

    /// Handle Remote  Video ///
    pc.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    // 2️⃣ Send ICE candidates to Supabase
    pc.current.onicecandidate = async (event) => {
      console.log("onicecandiate : entered");
      if (event.candidate) {
        console.log("candidate : ", event.candidate);
        await supabase.from("signals").insert([
          {
            room: joinedRoomId,
            sender: user.id,
            type: "candidate",
            data: event.candidate.toJSON(),
          },
        ]);
      }
    };

    // 3️⃣ Listen for signals from Supabase
    const channel = supabase
      .channel("signal-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
          filter: `room=eq.${joinedRoomId}`,
        },
        async (payload) => {
          if (payload.new.sender === user.id) return; // ignore own messages
          const { type, data } = payload.new;

          if (type === "offer") {
            // 👉 Joiner handles offer and replies with answer
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data)
            );
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            await supabase.from("signals").insert([
              {
                room: joinedRoomId,
                sender: user.id,
                type: "answer",
                data: answer,
              },
            ]);
          } else if (type === "answer") {
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data)
            );
          } else if (type === "candidate") {
            try {
              await pc.current.addIceCandidate(new RTCIceCandidate(data));
            } catch (err) {
              console.error("Error adding ICE:", err);
            }
          }
        }
      )
      .subscribe();

    // 4️⃣ Caller sends initial offer
    const startCall = async () => {
      if (createdRoomId) {
        console.log("📞 Creating offer...");
        const offer = await pc.current.createOffer();
        console.log("📡 Offer created");
        await pc.current.setLocalDescription(offer);
        console.log("✅ Local description set");
        await supabase.from("signals").insert([
          {
            room: joinedRoomId,
            sender: user.id,
            type: "offer",
            data: offer,
          },
        ]);
        console.log("📨 Offer sent to Supabase");
      }
    };

    // Only the creator (waiting user) starts the call
    startCall();

    return () => {
      supabase.removeChannel(channel);
      pc.current.close();
    };
  }, [joinedRoomId, createdRoomId]);

  //////////////////////////////////// Updating User Status ////////////////////////////////
  useEffect(() => {
    if (!joinedRoomId) return;

    let intervalId;

    const updateUserStatus = async () => {
      const { error: updateError } = await supabase
        .from("matches")
        .update({ connectedat: new Date().toISOString() })
        .eq("room", joinedRoomId)
        .eq("sender", user.id);

      if (updateError) {
        console.error("❌ Error updating user status:", updateError.message);
      }
    };

    // run every 30s
    intervalId = setInterval(() => {
      console.log("🔄 updating user status...");
      updateUserStatus();
    }, 30000);

    // cleanup → stop interval + delete row
    return () => {
      clearInterval(intervalId);

      const deleteUserMatch = async () => {
        const { error: deleteError } = await supabase
          .from("matches")
          .delete()
          .eq("room", joinedRoomId)
          .eq("sender", user.id);

        if (deleteError) {
          console.error(
            "❌ Error deleting match on exit:",
            deleteError.message
          );
        } else {
          console.log("✅ Deleted user match for room:", joinedRoomId);
        }
      };

      deleteUserMatch();
    };
  }, [joinedRoomId]);

  //////////////////////////////// Cheking other user live or not ///////////////////////////////////////

  /////////////////////////////////// Start When Buttom Clicked ///////////////////////////

  const getRoom = async () => {
    console.log("button clicked");
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("room, sendername")
        .eq("type", "waiting")
        .limit(1);
      if (error) {
        console.log("error fetching room : ", error.message);
      }
      /////////////////////// Joining Existing Room ////////////////////////////////
      if (data && data.length > 0) {
        const roomId = data[0].room;
        setSecondUserName(data[0].sendername);
        console.log("room found", roomId);
        const { data: insertData, error: insertError } = await supabase
          .from("matches")
          .insert([
            {
              room: roomId,
              sender: user.id,
              type: "joined",
              sendername: user.user_metadata.full_name,
              connectedat: new Date().toISOString(),
            },
          ])
          .select();
        if (insertError) {
          console.log("error in joining room ", insertError.message);
        } else {
          console.log("joined the already existing room ", insertData[0].room);
          setJoinedRoomId(insertData[0].room);
        }
        setUserJoined(true);
      }
      /////////////////////////// Creating A room ////////////////////////////////
      else {
        console.log("No waiting room found , creating a room . . . ");
        const newRoomId = uuidv4();
        const { data: insertData, error: insertError } = await supabase
          .from("matches")
          .insert([
            {
              room: newRoomId,
              sender: user.id,
              type: "waiting",
              sendername: user.user_metadata.full_name,
              connectedat: new Date().toISOString(),
            },
          ])
          .select();
        if (insertError) {
          console.error("Error creating new room:", insertError.message);
        } else {
          console.log("New room created:", insertData[0].room);
          setCreatedRoomId(insertData[0].room);
        }
      }
    } catch (error) {
      console.log("unexpected error", error);
    }
  };

  //////////////////// sending Messgae ////////////////////////

  const sendMessage = async () => {
    if (!userJoined) {
      console.log("⚠️ Cannot send message, no user joined yet!");
      return;
    }
    const { data: msgData, error: msgError } = await supabase
      .from("chatroom")
      .insert([
        {
          room: joinedRoomId,
          user: user.id,
          message: userMessage,
          createdat: new Date().toISOString(),
        },
      ])
      .select();

    if (msgError) {
      console.log("error in sending message : ", msgError);
    } else {
      console.log("message updated successfully : ", msgData[0].message);
    }
  };

  //////////////////////////// loading Messages ///////////////////

  useEffect(() => {
    if (!joinedRoomId) return;
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("chatroom")
        .select("*")
        .eq("room", joinedRoomId)
        .order("createdat", { ascending: true });
      if (error) {
        console.error("error in getting messages : ", error.message);
      } else {
        console.log("Messages loaded : ", data);
        setMessage(data);
      }
    };
    loadMessages();

    const channel = supabase
      .channel("chatListner")
      .on(
        "postgres_changes",
        {
          event: "insert",
          schema: "public",
          table: "chatroom",
          filter: `room=eq.${joinedRoomId}`,
        },
        (payload) => {
          console.log("new message recieved : ", payload.new);
          setMessage((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();
    return () => {
      console.log("unsubscribe channel");
      supabase.removeChannel(channel);
    };
  }, [joinedRoomId]);
  return (
    <div>
      {!userJoined ? (
        <div className=" flex flex-col justify-center items-center p-3  ">
          <button onClick={getRoom} className="p-2 px-5 rounded-sm bg-blue-500">
            Connect
          </button>
        </div>
      ) : (
        <div className=" flex flex-col justify-center items-center p-3  ">
          <div className="flex flex-col    text-white ">
            <h1>{secondUserName}</h1>
            <div className="flex gap-2">
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="w-1/2 border"
              />
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="w-1/2 border"
              />
            </div>
            {/* Chat Messages */}
            <div className="flex flex-col overflow-y-auto h-[200px]  space-y-3 bg-[#e1b6b0] ">
              {message.map((msg, i) => {
                const time = new Date(msg.createdat).toISOString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={i}
                    className={`flex  ${
                      msg.user === user.id ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-2xl shadow flex-col
                ${
                  msg.user === user.id
                    ? "bg-blue-500 text-white"
                    : "bg-purple-500 text-white"
                }`}
                    >
                      {msg.message}
                      <div className="text-white text-[10px]">{time}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Box */}
            <div className="p-4 flex gap-2 border-t border-gray-700  bg-gray-900 ">
              <input
                type="text"
                placeholder="Type a message..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white focus:outline-none"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
