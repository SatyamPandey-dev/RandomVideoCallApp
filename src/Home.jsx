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

  const isManualLeaveRef = useRef(false);
  var count = 0;

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
  //       {
  //         urls: "turn:relay1.expressturn.com:3478",
  //         username: "ef-test",
  //         credential: "ef-test-pass",
  //       },
  //     ],
  //   });

  //   // ✅ Improvement #1: ICE Gathering Debug
  //   pc.current.onicegatheringstatechange = () => {
  //     console.log("ICE gathering state:", pc.current.iceGatheringState);
  //   };

  //   /// Local Video Setup ///
  //   navigator.mediaDevices
  //     .getUserMedia({ video: true, audio: true })
  //     .then(async (stream) => {
  //       console.log("🎥 Local stream acquired");
  //       localVideo.current.srcObject = stream;

  //       stream
  //         .getTracks()
  //         .forEach((track) => pc.current.addTrack(track, stream));

  //       // ✅ Offer created *after* tracks are added
  //       if (createdRoomId) {
  //         console.log("📞 Creating offer...");
  //         const offer = await pc.current.createOffer();
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
  //     .catch((err) => console.error("❌ Error accessing camera/mic:", err));

  //   /// Handle Remote Video ///
  //   pc.current.ontrack = (event) => {
  //     console.log("📺 Got remote stream:", event.streams[0]);
  //     remoteVideo.current.srcObject = event.streams[0];

  //     event.streams[0].getTracks().forEach((track) => {
  //       track.onended = () => {
  //         console.log("Remote user left – closing stream");
  //         setTrackEnded(true);
  //         setUserJoined(false);
  //       };
  //     });
  //   };

  //   // ✅ Improvement #2: ICE queue logic
  //   let candidateQueue = [];
  //   let remoteDescriptionSet = false;

  //   // ✅ Connection State Logic
  //   let retryCount = 0;
  //   const MAX_RETRIES = 1;
  //   const RETRY_DELAY_MS = 1000;

  //   pc.current.onconnectionstatechange = () => {
  //     const state = pc.current.connectionState;
  //     console.log("📡 Connection state changed:", state);

  //     if (state === "connected") {
  //       retryCount = 0;
  //       console.log("✅ Peer connection established");
  //     }

  //     if (
  //       state === "closed" ||
  //       state === "disconnected" ||
  //       state === "failed"
  //     ) {
  //       console.warn("⚠️ Peer disconnected or failed");

  //       if (!trackEnded && userJoined) {
  //         setTrackEnded(true);
  //       }

  //       return;
  //     }
  //   };

  //   // ✅ Send ICE Candidates
  //   pc.current.onicecandidate = async (event) => {
  //     if (event.candidate) {
  //       console.log("🔥 Sending ICE candidate:", event.candidate);
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

  //   // ✅ Listen Signals
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
  //         if (payload.new.sender === user.id) return;

  //         const { type, data } = payload.new;

  //         if (type === "offer") {
  //           console.log("📥 Received offer");
  //           await pc.current.setRemoteDescription(
  //             new RTCSessionDescription(data)
  //           );
  //           remoteDescriptionSet = true;

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

  //           // ✅ Flush queued ICE
  //           for (const c of candidateQueue) {
  //             try {
  //               await pc.current.addIceCandidate(new RTCIceCandidate(c));
  //               console.log("✅ Added queued ICE");
  //             } catch (e) {
  //               console.error("❌ Error adding queued ICE:", e);
  //             }
  //           }
  //           candidateQueue = [];
  //         }

  //         if (type === "answer") {
  //           console.log("📥 Received answer");
  //           await pc.current.setRemoteDescription(
  //             new RTCSessionDescription(data)
  //           );
  //           remoteDescriptionSet = true;

  //           for (const c of candidateQueue) {
  //             try {
  //               await pc.current.addIceCandidate(new RTCIceCandidate(c));
  //             } catch (e) {
  //               console.error("❌ Error adding queued ICE:", e);
  //             }
  //           }
  //           candidateQueue = [];
  //         }

  //         if (type === "candidate") {
  //           console.log("📥 Received ICE:", data);

  //           if (!remoteDescriptionSet) {
  //             console.warn(
  //               "⚠️ Queuing ICE because remote description not set yet"
  //             );
  //             candidateQueue.push(data);
  //             return;
  //           }

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
  //     if (pc.current) pc.current.close();
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
          username: "ef-test",
          credential: "ef-test-pass",
        },
      ],
    });

    // Debug: ICE gathering
    pc.current.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.current.iceGatheringState);
    };

    /// Local Video Setup ///
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (stream) => {
        console.log("🎥 Local stream acquired");
        localVideo.current.srcObject = stream;

        stream
          .getTracks()
          .forEach((track) => pc.current.addTrack(track, stream));

        // -----------------------
        // Offer logic: DELAY + RETRY
        // -----------------------
        // Only run offer flow if this client created the room (createdRoomId present)
        if (createdRoomId) {
          // small delay so the remote can subscribe to signals
          await new Promise((r) => setTimeout(r, 1200));

          let offerRetries = 0;
          const MAX_OFFER_RETRIES = 3;
          const OFFER_RETRY_DELAY_MS = 2000;

          const sendOffer = async () => {
            try {
              console.log("📞 Creating offer...");
              const offer = await pc.current.createOffer();
              await pc.current.setLocalDescription(offer);
              console.log("✅ Local description set (offer)");

              await supabase.from("signals").insert([
                {
                  room: joinedRoomId,
                  sender: user.id,
                  type: "offer",
                  data: offer,
                },
              ]);
              console.log("📨 Offer sent to Supabase");
            } catch (err) {
              console.error("❌ Error creating/sending offer:", err);
            }
          };

          // first attempt
          await sendOffer();

          // auto-retry: if no remoteDescription (answer) after timeout, resend offer
          const offerRetryTimer = setInterval(async () => {
            if (!pc.current) {
              clearInterval(offerRetryTimer);
              return;
            }

            // remote description is set when we receive an answer
            const hasRemote = !!pc.current.remoteDescription;
            if (hasRemote) {
              clearInterval(offerRetryTimer);
              return;
            }

            if (offerRetries < MAX_OFFER_RETRIES) {
              offerRetries++;
              console.warn(
                `⏳ No answer yet — resending offer (attempt ${offerRetries})`
              );
              await sendOffer();
            } else {
              console.error(
                "🚨 No answer after retries — giving up offer retries"
              );
              clearInterval(offerRetryTimer);
            }
          }, OFFER_RETRY_DELAY_MS);
          // store timer on pc so cleanup can clear it if component unmounts
          pc.current._offerRetryTimer = offerRetryTimer;
        }
      })
      .catch((err) => console.error("❌ Error accessing camera/mic:", err));

    /// Handle Remote Video ///
    pc.current.ontrack = (event) => {
      console.log("📺 Got remote stream:", event.streams[0]);
      remoteVideo.current.srcObject = event.streams[0];

      event.streams[0].getTracks().forEach((track) => {
        track.onended = () => {
          console.log("Remote user left – closing stream");
          setTrackEnded(true);
          setUserJoined(false);
        };
      });
    };

    // -----------------------
    // ICE queue logic (guaranteed flush)
    // -----------------------
    let candidateQueue = [];
    let remoteDescriptionSet = false;

    // Connection state
    let retryCount = 0;
    const MAX_RETRIES = 1;
    const RETRY_DELAY_MS = 1000;

    pc.current.onconnectionstatechange = () => {
      const state = pc.current.connectionState;
      console.log("📡 Connection state changed:", state);

      if (state === "connected") {
        retryCount = 0;
        console.log("✅ Peer connection established");
      }

      if (
        state === "closed" ||
        state === "disconnected" ||
        state === "failed"
      ) {
        console.warn("⚠️ Peer disconnected or failed");

        if (!trackEnded && userJoined) {
          setTrackEnded(true);
        }
        return;
      }
    };

    // Send ICE candidates to Supabase (always send — remote will add them when ready)
    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("🔥 Sending ICE candidate:", event.candidate);
        try {
          await supabase.from("signals").insert([
            {
              room: joinedRoomId,
              sender: user.id,
              type: "candidate",
              data: event.candidate.toJSON(),
            },
          ]);
        } catch (err) {
          console.error("❌ Failed to send ICE to Supabase:", err);
        }
      } else {
        console.log("🚫 No more ICE candidates (null)");
      }
    };

    // Listen to incoming signals
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
          try {
            if (!payload?.new) return;
            if (payload.new.sender === user.id) return;

            const { type, data } = payload.new;

            if (type === "offer") {
              console.log("📥 Received offer");
              // set remote description (await this)
              await pc.current.setRemoteDescription(
                new RTCSessionDescription(data)
              );
              remoteDescriptionSet = true;
              console.log("✅ Remote description (offer) set");

              // create & send answer
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

              // flush any queued ICE candidates
              if (candidateQueue.length) {
                console.log(
                  `📦 Flushing ${candidateQueue.length} queued ICE candidates`
                );
                for (const c of candidateQueue) {
                  try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(c));
                  } catch (e) {
                    console.error("❌ Error adding queued ICE:", e);
                  }
                }
                candidateQueue = [];
              }
            } else if (type === "answer") {
              console.log("📥 Received answer");
              await pc.current.setRemoteDescription(
                new RTCSessionDescription(data)
              );
              remoteDescriptionSet = true;
              console.log("✅ Remote description (answer) set");

              // flush queued ICE candidates
              if (candidateQueue.length) {
                console.log(
                  `📦 Flushing ${candidateQueue.length} queued ICE candidates`
                );
                for (const c of candidateQueue) {
                  try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(c));
                  } catch (e) {
                    console.error("❌ Error adding queued ICE:", e);
                  }
                }
                candidateQueue = [];
              }
            } else if (type === "candidate") {
              // incoming ICE
              console.log("📥 Received ICE:", data);

              // If remote description is not set yet, queue the ICE safely.
              // But also set up a fallback waiter which will add it once remote description exists.
              if (!remoteDescriptionSet && !pc.current.remoteDescription) {
                console.warn(
                  "⚠️ Queuing ICE because remote description not set yet"
                );
                candidateQueue.push(data);

                // safety: periodically check and flush this candidate if remote description becomes available
                const waiter = setInterval(async () => {
                  if (!pc.current) {
                    clearInterval(waiter);
                    return;
                  }
                  if (pc.current.remoteDescription) {
                    clearInterval(waiter);
                    try {
                      // flush all queued at that time (we'll flush in the normal code path too)
                      for (const c of candidateQueue) {
                        await pc.current.addIceCandidate(
                          new RTCIceCandidate(c)
                        );
                      }
                      candidateQueue = [];
                      console.log("✅ Flushed queued ICE (via waiter)");
                    } catch (e) {
                      console.error(
                        "❌ Error flushing queued ICE via waiter:",
                        e
                      );
                    }
                  }
                }, 150);
                // stop the waiter automatically after a timeout to avoid infinite intervals
                setTimeout(() => clearInterval(waiter), 20000);
                return;
              }

              try {
                await pc.current.addIceCandidate(new RTCIceCandidate(data));
                console.log("✅ Added ICE candidate successfully");
              } catch (err) {
                console.error("❌ Error adding ICE:", err);
                // if addIceCandidate failed and remote description not set, queue and let the waiter/flush handle
                if (!pc.current.remoteDescription) {
                  candidateQueue.push(data);
                }
              }
            }
          } catch (e) {
            console.error("❌ Error processing signal payload:", e);
          }
        }
      )
      .subscribe();

    // cleanup
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn("Failed to remove channel:", e);
      }

      // clear offer retry timer if present
      try {
        if (pc.current?._offerRetryTimer) {
          clearInterval(pc.current._offerRetryTimer);
        }
      } catch (e) {}

      if (pc.current) {
        try {
          pc.current.close();
        } catch (e) {}
        pc.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedRoomId, createdRoomId]);

  //////////////////////////////////////////////////////////////////////////////

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
    <div>
      <div className=" flex flex-col justify-center items-center p-3  ">
        <div className="flex flex-col    text-white ">
          {!userJoined ? <h1>User Name</h1> : <h1>{secondUserName}</h1>}

          <div className="flex gap-2">
            {!userJoined ? (
              <img alt="Local" className="w-1/2 border" />
            ) : (
              <video
                ref={localVideo}
                autoPlay
                playsInline
                className="w-1/2 border"
              />
            )}
            {!userJoined ? (
              <img alt="Remote" className="w-1/2 border" />
            ) : (
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="w-1/2 border"
              />
            )}
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
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
              >
                Send
              </button>
              <button
                type="button"
                className="bg-green-600 hover:bg-green-400 px-4 py-2 rounded-lg"
                onClick={nextRoom}
              >
                Next
              </button>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
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

export default Home;
