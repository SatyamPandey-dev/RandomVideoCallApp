import noSignal from "./assets/noSignal.png";
import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";
import useWebRTC from "./useWebRTC";

export default function Home({ user }) {
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [joinedRoomId, setJoinedRoomId] = useState(null);
  const [userJoined, setUserJoined] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [message, setMessage] = useState([]);
  const [secondUserName, setSecondUserName] = useState("");
  const [trackEnded, setTrackEnded] = useState(false);

  const isManualLeaveRef = useRef(false);

  const { localVideo, remoteVideo, pc } = useWebRTC(
    user,
    joinedRoomId,
    createdRoomId,
    userJoined,
    setUserJoined,
    trackEnded,
    setTrackEnded
  );
  var count = 0;

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

    const deleteUserMatch = async () => {
      const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .eq("room", createdRoomId)
        .eq("sender", user.id);

      if (deleteError) {
        console.error("❌ Error deleting match on exit:", deleteError.message);
      } else {
        console.log("✅ Deleted user match for room:", joinedRoomId);
        alert("No one is currently alive , plz retry after few seconds");
      }
      clearInterval(intervalId);
    };

    intervalId = setInterval(() => {
      console.log("Checking room:", createdRoomId);
      checkJoin();
      console.log("count :", count);
      count = count + 1;
      if (count > 5) {
        deleteUserMatch();
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [createdRoomId]);

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
        .select("room, sendername,sender")
        .eq("type", "waiting")
        .limit(1);
      if (error) {
        console.log("error fetching room : ", error.message);
      }
      /////////////////////// Joining Existing Room ////////////////////////////////
      if (data && data.length > 0) {
        if (data[0].sender == user.id) {
          console.log("✅ already joined");
          await deleteUserMatch();
          console.log("retring");
        }
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
  useEffect(() => {
    if (trackEnded && !isManualLeaveRef.current) {
      (async () => {
        console.log("Track ended (remote) — moving to next room");
        await nextRoom();
        setTrackEnded(false);
      })();
    } else if (trackEnded && isManualLeaveRef.current) {
      // manual leave triggered the track end — ignore it
      console.log("Track ended due to manual leave — ignoring auto-next");
      setTrackEnded(false);
    }
  }, [trackEnded]);

  ////////////////////// Next Button ////////////////////

  const nextRoom = async () => {
    if (isManualLeaveRef.current) {
      console.log("nextRoom blocked: manual leave in progress");
      return;
    }

    try {
      console.log("➡️ Starting nextRoom...");
      await leaveRoom();
      setTrackEnded(false);
      await getRoom();
    } catch (error) {
      console.error("error in moving next Room : ", error);
    }
  };

  ////////////////////// Leave Button ///////////////////////
  const leaveRoom = async () => {
    try {
      // mark manual leave synchronously
      isManualLeaveRef.current = true;

      if (!joinedRoomId) {
        // reset the manual flag quickly if nothing to do
        setTimeout(() => (isManualLeaveRef.current = false), 500);
        return;
      }

      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("room", joinedRoomId);

      setUserJoined(false);
      setCreatedRoomId(null);
      setJoinedRoomId(null);

      // REMOVE onended handlers so stopping tracks won't trigger onended
      try {
        if (remoteVideo.current?.srcObject) {
          remoteVideo.current.srcObject.getTracks().forEach((t) => {
            try {
              t.onended = null;
            } catch (e) {}
          });
        }
        if (localVideo.current?.srcObject) {
          localVideo.current.srcObject.getTracks().forEach((t) => {
            try {
              t.onended = null;
            } catch (e) {}
          });
        }
      } catch (e) {
        console.warn("Failed to clear onended handlers:", e);
      }

      if (pc.current) {
        try {
          pc.current.getSenders().forEach((s) => s.track?.stop());
        } catch (e) {
          console.warn("Error stopping senders:", e);
        }
        try {
          pc.current.close();
        } catch (e) {}
        pc.current = null;
      }

      if (error) {
        alert("error in leaving room");
      }
    } catch (error) {
      console.log("unexpected error", error);
    } finally {
      // leave a short window where manual-leave is true so any synchronous onended won't trigger auto-next
      setTimeout(() => {
        isManualLeaveRef.current = false;
      }, 500);
    }
  };

  return (
    <div className="overflow-x-hidden gradient-bg min-h-screen xl:max-h-screen xl:overflow-y-hidden ">
      <div className="flex justify-between items-center lg:px-10 px-5 py-2 ">
        <h1 className="text-gray-50 font-bold lg:text-[50px] text-[20px] ">
          Socio
        </h1>
        <button className="text-gray-50 poppins-blod lg:text-[20px] lg:px-12 lg:py-2 text-[10px] px-5 py-1 glass-2  border-[2px] border-white rounded-lg ">
          home
        </button>
      </div>
      <div className="flex flex-col xl:flex-row  w-screen justify-center items-center sm:gap-5 xl:gap-16  ">
        <div className=" flex flex-col justify-between items-center xl:w-2/3  xl:h-[85vh] lg:pt-5 pt-1 ">
          <div className="flex flex-col   text-white  ">
            <div className="flex justify-between items-center px-2 py-2 ">
              {!userJoined ? <h1>User Name</h1> : <h1>{secondUserName}</h1>}
              {!userJoined ? <h1>User Name</h1> : <h1>{secondUserName}</h1>}
            </div>

            <div className="flex gap-1 justify-center items-center  border-[5px] box  w-[300px]  h-[47vh]  sm:w-[670px] sm:h-[370px] rounded-2xl sm:mb-1 z-10 ">
              {!userJoined ? (
                <img
                  className="hidden sm:block  sm:w-1/2 h-full object-cover rounded-2xl"
                  src={noSignal}
                />
              ) : (
                <video
                  className="hidden sm:block  sm:w-1/2 h-full object-cover rounded-2xl"
                  ref={localVideo}
                  autoPlay
                  muted
                  playsInline
                />
              )}
              {!userJoined ? (
                <img
                  className=" w-full sm:w-1/2 h-full object-cover rounded-2xl"
                  src={noSignal}
                />
              ) : (
                <video
                  className="w-full sm:w-1/2 h-full object-cover rounded-2xl"
                  ref={remoteVideo}
                  autoPlay
                  playsInline
                />
              )}
            </div>

            <div className="lg:p-4 p-1 flex gap-2 justify-center items-center px-2 glass   ">
              <button
                type="button"
                className="bg-green-600 hover:bg-green-400 px-4 py-2 rounded-lg "
                onClick={nextRoom}
              >
                Next
              </button>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg  "
                onClick={leaveRoom}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 lg:gap-3 xl:pt-5 sm:w-[670px]   chat xl:w-1/3 xl:pr-20  ">
          {/* Chat Messages */}
          <div className="flex flex-col  overflow-y-auto h-[27vh] xl:h-[70vh] box2   glass ">
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
            <div className="lg:p-4 p-1 flex gap-2 border-t glass rounded-2xl ">
              <input
                type="text"
                placeholder="Type a message..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white focus:outline-none"
              />
              <button
                // onClick={sendMessage}
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
              >
                Send
              </button>
              <button
                type="button"
                className="bg-green-600 hover:bg-green-400 px-4 py-2 rounded-lg hidden "
                onClick={nextRoom}
              >
                Next
              </button>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg hidden "
                onClick={leaveRoom}
              >
                Leave
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
