// ✅ useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient"; // adjust path

export default function useWebRTC(
  user,
  joinedRoomId,
  createdRoomId,
  userJoined
) {
  const [trackEnded, setTrackEnded] = useState(false);

  const pc = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  let retryCount = 0;

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
        if (createdRoomId) {
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

          const offerRetryTimer = setInterval(async () => {
            if (!pc.current) {
              clearInterval(offerRetryTimer);
              return;
            }

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
    // ICE queue logic
    // -----------------------
    let candidateQueue = [];
    let remoteDescriptionSet = false;

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
              await pc.current.setRemoteDescription(
                new RTCSessionDescription(data)
              );
              remoteDescriptionSet = true;
              console.log("✅ Remote description (offer) set");

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
              console.log("📥 Received ICE:", data);

              if (!remoteDescriptionSet && !pc.current.remoteDescription) {
                console.warn(
                  "⚠️ Queuing ICE because remote description not set yet"
                );
                candidateQueue.push(data);

                const waiter = setInterval(async () => {
                  if (!pc.current) {
                    clearInterval(waiter);
                    return;
                  }
                  if (pc.current.remoteDescription) {
                    clearInterval(waiter);
                    try {
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

                setTimeout(() => clearInterval(waiter), 20000);
                return;
              }

              try {
                await pc.current.addIceCandidate(new RTCIceCandidate(data));
                console.log("✅ Added ICE candidate successfully");
              } catch (err) {
                console.error("❌ Error adding ICE:", err);
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

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn("Failed to remove channel:", e);
      }

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
  }, [joinedRoomId, createdRoomId]);

  // ✅ RETURN necessary variables to use in main component
  return {
    localVideo,
    remoteVideo,
    setTrackEnded,
    pc,
  };
}
