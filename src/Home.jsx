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
  const [trackEnded, setTrackEnded] = useState(false);
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
  // useEffect(() => {
  //   if (!joinedRoomId) return;

  //   pc.current = new RTCPeerConnection({
  //     iceServers: [
  //       {
  //         urls: [
  //           "stun:stun1.l.google.com:19302",
  //           "stun:stun2.l.google.com:19302",
  //         ],
  //       },
  //     ],
  //   });

  //   // 🧠 Debug: Watch ICE gathering progress
  //   pc.current.onicegatheringstatechange = () => {
  //     console.log("ICE gathering state:", pc.current.iceGatheringState);
  //   };

  //   /// Local  Video Setup ///
  //   navigator.mediaDevices
  //     .getUserMedia({ video: true, audio: true })
  //     .then(async (stream) => {
  //       console.log("🎥 Local stream acquired");
  //       localVideo.current.srcObject = stream;
  //       stream
  //         .getTracks()
  //         .forEach((track) => pc.current.addTrack(track, stream));

  //       // ✅ Move offer creation *after* local tracks are added
  //       if (createdRoomId) {
  //         console.log("📞 Creating offer...");
  //         const offer = await pc.current.createOffer();
  //         console.log("📡 Offer created");
  //         await pc.current.setLocalDescription(offer);
  //         console.log("✅ Local description set");
  //         await supabase.from("signals").insert([
  //           {
  //             room: joinedRoomId,
  //             sender: user.id,
  //             type: "offer",
  //             data: offer,
  //           },
  //         ]);
  //         console.log("📨 Offer sent to Supabase");
  //       }
  //     })
  //     .catch((err) => {
  //       console.error("❌ Error accessing camera/mic:", err);
  //     });

  //   /// Handle Remote  Video ///
  //   pc.current.ontrack = (event) => {
  //     console.log("📺 Got remote stream:", event.streams[0]);
  //     remoteVideo.current.srcObject = event.streams[0];

  //     // 🧩 Detect when remote track stops (peer left or crashed)
  //     event.streams[0].getTracks().forEach((track) => {
  //       track.onended = () => {
  //         console.warn("⚠️ Remote track ended – user may have gone offline");
  //         alert("The other user has disconnected or ended the call.");
  //         setUserJoined(false);
  //       };
  //     });
  //   };

  //   // 🧠 Detect connection state changes (WebRTC built-in offline detection)
  //   pc.current.onconnectionstatechange = () => {
  //     console.log("📡 Connection state changed:", pc.current.connectionState);
  //     const state = pc.current.connectionState;

  //     // 🆕 When best connection established, reattach remote video only if missing
  //     if (state === "connected") {
  //       console.log(
  //         "✅ Peer connection is fully connected, checking remote video..."
  //       );

  //       // Only rebuild if remote video is not set or empty
  //       const currentStream = remoteVideo.current?.srcObject;
  //       const noStream =
  //         !currentStream ||
  //         !(currentStream instanceof MediaStream) ||
  //         currentStream.getTracks().length === 0;

  //       if (noStream) {
  //         console.log(
  //           "🔄 Remote video missing — attempting to refresh from receivers"
  //         );
  //         const receivers = pc.current.getReceivers().filter((r) => r.track);
  //         const newStream = new MediaStream(receivers.map((r) => r.track));

  //         if (newStream.getTracks().length > 0) {
  //           remoteVideo.current.srcObject = newStream;
  //           console.log(
  //             "🎞️ Remote video stream refreshed after stable connection"
  //           );
  //         } else {
  //           console.warn(
  //             "⚠️ No active receiver tracks found to rebuild stream"
  //           );
  //         }
  //       } else {
  //         console.log("✅ Remote video already attached — no refresh needed");
  //       }
  //     }

  //     if (
  //       state === "disconnected" ||
  //       state === "failed" ||
  //       state === "closed"
  //     ) {
  //       console.warn("⚠️ Peer connection lost or closed");
  //       alert("The other user went offline or the call ended.");
  //       setUserJoined(false);
  //       if (remoteVideo.current) remoteVideo.current.srcObject = null;
  //     }
  //   };

  //   // 2️⃣ Send ICE candidates to Supabase
  //   pc.current.onicecandidate = async (event) => {
  //     console.log("onicecandiate : entered");
  //     if (event.candidate) {
  //       console.log("🔥 candidate : ", event.candidate);
  //       await supabase.from("signals").insert([
  //         {
  //           room: joinedRoomId,
  //           sender: user.id,
  //           type: "candidate",
  //           data: event.candidate.toJSON(),
  //         },
  //       ]);
  //     } else {
  //       console.log("🚫 No more ICE candidates (null)");
  //     }
  //   };

  //   // 3️⃣ Listen for signals from Supabase
  //   const channel = supabase
  //     .channel("signal-listener")
  //     .on(
  //       "postgres_changes",
  //       {
  //         event: "INSERT",
  //         schema: "public",
  //         table: "signals",
  //         filter: `room=eq.${joinedRoomId}`,
  //       },
  //       async (payload) => {
  //         if (payload.new.sender === user.id) return; // ignore own messages
  //         const { type, data } = payload.new;

  //         if (type === "offer") {
  //           // 👉 Joiner handles offer and replies with answer
  //           console.log("📥 Received offer from remote user");
  //           await pc.current.setRemoteDescription(
  //             new RTCSessionDescription(data)
  //           );
  //           const answer = await pc.current.createAnswer();
  //           await pc.current.setLocalDescription(answer);
  //           await supabase.from("signals").insert([
  //             {
  //               room: joinedRoomId,
  //               sender: user.id,
  //               type: "answer",
  //               data: answer,
  //             },
  //           ]);
  //           console.log("📤 Sent answer to Supabase");
  //         } else if (type === "answer") {
  //           console.log("📥 Received answer, setting remote description");
  //           await pc.current.setRemoteDescription(
  //             new RTCSessionDescription(data)
  //           );
  //         } else if (type === "candidate") {
  //           console.log("📥 Received candidate:", data);
  //           try {
  //             await pc.current.addIceCandidate(new RTCIceCandidate(data));
  //             console.log("✅ Added ICE candidate successfully");
  //           } catch (err) {
  //             console.error("❌ Error adding ICE:", err);
  //           }
  //         }
  //       }
  //     )
  //     .subscribe();

  //   return () => {
  //     supabase.removeChannel(channel);
  //     pc.current.close();
  //   };
  // }, [joinedRoomId, createdRoomId]);

  useEffect(() => {
    if (!joinedRoomId) return;

    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "ef-test", // use your own credentials for production
          credential: "ef-test-pass",
        },
      ],
    });

    // 🧠 Debug: Watch ICE gathering progress
    pc.current.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.current.iceGatheringState);
    };

    /// Local  Video Setup ///
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (stream) => {
        console.log("🎥 Local stream acquired");
        localVideo.current.srcObject = stream;
        stream
          .getTracks()
          .forEach((track) => pc.current.addTrack(track, stream));

        // ✅ Move offer creation *after* local tracks are added
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
      })
      .catch((err) => {
        console.error("❌ Error accessing camera/mic:", err);
      });

    /// Handle Remote  Video ///
    pc.current.ontrack = (event) => {
      console.log("📺 Got remote stream:", event.streams[0]);
      remoteVideo.current.srcObject = event.streams[0];

      // 🧩 Detect when remote track stops (peer left or crashed)
      event.streams[0].getTracks().forEach((track) => {
        track.onended = () => {
          console.log("The other user has disconnected or ended the call.");
          setTrackEnded(true);
          setUserJoined(false);
        };
      });
    };

    // 🧠 Detect connection state changes (WebRTC built-in offline detection)
    let retryCount = 0;
    const MAX_RETRIES = 1;
    const RETRY_DELAY_MS = 1000;

    pc.current.onconnectionstatechange = () => {
      const state = pc.current.connectionState;
      console.log("📡 Connection state changed:", state);

      if (state === "connected") {
        console.log("✅ Peer connection established");
        retryCount = 0; // reset retry count
      }

      if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        console.warn("⚠️ Peer connection lost or closed");

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`🔁 Retrying connection... attempt ${retryCount}`);
          setTimeout(async () => {
            if (createdRoomId) {
              console.log("📞 Recreating offer to reconnect...");
              const offer = await pc.current.createOffer();
              await pc.current.setLocalDescription(offer);
              await supabase.from("signals").insert([
                {
                  room: joinedRoomId,
                  sender: user.id,
                  type: "offer",
                  data: offer,
                },
              ]);
            }
          }, RETRY_DELAY_MS * retryCount);
        } else {
          console.log(
            "Connection failed after several attempts. Please refresh or rejoin."
          );

          setUserJoined(false);
          setTrackEnded(true);
          if (remoteVideo.current) remoteVideo.current.srcObject = null;
        }
      }
    };

    // 2️⃣ Send ICE candidates to Supabase
    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("🔥 Sending ICE candidate:", event.candidate);
        await supabase.from("signals").insert([
          {
            room: joinedRoomId,
            sender: user.id,
            type: "candidate",
            data: event.candidate.toJSON(),
          },
        ]);
      } else {
        console.log("🚫 No more ICE candidates (null)");
      }
    };

    // 3️⃣ Listen for signals from Supabase
    let candidateQueue = [];
    let remoteDescriptionSet = false;

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
            console.log("📥 Received offer from remote user");
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data)
            );
            remoteDescriptionSet = true;

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
            console.log("📤 Sent answer to Supabase");

            // Flush queued candidates
            for (const c of candidateQueue) {
              try {
                await pc.current.addIceCandidate(new RTCIceCandidate(c));
              } catch (err) {
                console.error("❌ Error adding queued ICE:", err);
              }
            }
            candidateQueue = [];
          } else if (type === "answer") {
            console.log("📥 Received answer, setting remote description");
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data)
            );
            remoteDescriptionSet = true;

            // Flush queued candidates
            for (const c of candidateQueue) {
              try {
                await pc.current.addIceCandidate(new RTCIceCandidate(c));
              } catch (err) {
                console.error("❌ Error adding queued ICE:", err);
              }
            }
            candidateQueue = [];
          } else if (type === "candidate") {
            console.log("📥 Received ICE candidate:", data);

            if (!remoteDescriptionSet) {
              console.warn(
                "⚠️ Remote description not set yet — queuing ICE candidate"
              );
              candidateQueue.push(data);
              return;
            }

            try {
              await pc.current.addIceCandidate(new RTCIceCandidate(data));
              console.log("✅ Added ICE candidate successfully");
            } catch (err) {
              console.error("❌ Error adding ICE:", err);

              // Retry logic for ICE add failures
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.warn(`🔁 Retrying ICE add... attempt ${retryCount}`);
                setTimeout(() => {
                  pc.current
                    .addIceCandidate(new RTCIceCandidate(data))
                    .then(() =>
                      console.log("✅ Retried ICE added successfully")
                    )
                    .catch((e) => console.error("❌ Retry ICE failed:", e));
                }, RETRY_DELAY_MS * retryCount);
              } else {
                console.error(
                  "🚨 Max ICE retries reached — manual reconnect needed."
                );
                setTrackEnded(true);
                setUserJoined(false);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pc.current) {
        pc.current.close();
      }
    };
  }, [joinedRoomId, createdRoomId]);

  ///////////////////////////////////// Cleaning offline users ///////////////////

  // useEffect(() => {
  //   if (!userJoined && joinedRoomId) {
  //     const cleanUser = async () => {
  //       const { error } = await supabase
  //         .from("matches")
  //         .delete()
  //         .eq("room", joinedRoomId);

  //       if (error) console.error("Cleanup error:", error);
  //       else {
  //         console.log("Cleanup success for rooms:");
  //         setJoinedRoomId(null);
  //         setCreatedRoomId(null);
  //       }
  //     };
  //     cleanUser();
  //   }
  // }, [userJoined, joinedRoomId]);

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

      // deleteUserMatch();
    };
  }, [joinedRoomId]);

  /////////////////////////////////// Start When Buttom Clicked ///////////////////////////

  const getRoom = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      console.error("Error accessing media devices:", err);
      return; // this stops the entire getRoom() function
    }

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
      /////////////////////////// ⁡⁢⁣⁣𝗖𝗿𝗲𝗮𝘁𝗶𝗻𝗴 𝗔 𝗿𝗼𝗼𝗺⁡ ////////////////////////////////
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
      setUserMessage("");
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

  //////////////////// track //////////
  if (trackEnded) {
    nextRoom();
    setTrackEnded(false);
  }

  ////////////////////// Next Button ////////////////////

  const nextRoom = async () => {
    try {
      console.log("➡️ Starting nextRoom...");
      await leaveRoom();
      console.log("✅ leaveRoom finished, now calling getRoom");
      await getRoom();
      console.log("✅ getRoom finished");
    } catch (error) {
      console.error("error in moving next Room : ", error);
    }
  };

  ////////////////////// Leave Button ///////////////////////

  const leaveRoom = async () => {
    try {
      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("room", joinedRoomId);

      setUserJoined(false);
      setCreatedRoomId(null);
      setJoinedRoomId(null);
      if (error) {
        console.alert("error in leaving room");
      }
    } catch (error) {
      console.log("unexpected error", error);
    }
  };

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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <div className="p-4 flex gap-2 border-t border-gray-700  bg-gray-900 ">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white focus:outline-none"
                />
                <button
                  // onClick={sendMessage}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                >
                  Send
                </button>
                <button
                  className="bg-green-600 hover:bg-green-400 px-4 py-2 rounded-lg"
                  onClick={nextRoom}
                >
                  Next
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
                  onClick={leaveRoom}
                >
                  Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
