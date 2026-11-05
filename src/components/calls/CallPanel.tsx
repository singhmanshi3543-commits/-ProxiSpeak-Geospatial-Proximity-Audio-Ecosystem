import { useEffect, useRef, useState } from "react";
import { connectSocket } from "../../services/socket";
import "./CallPanel.css";
import { spatialAudio } from "../../services/spatialAudio";

type Props = {
  targetUserId: string;
  targetName: string;
  onClose: () => void;
  initialCallType?: "voice" | "video";
};

type IncomingCall = {
  callId: string;
  mode: "voice" | "video";
  caller: {
    id: string;
    username?: string;
    displayName?: string;
  };
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function CallPanel({
  targetUserId,
  targetName,
  onClose,
  initialCallType = "voice",
}: Props) {
  const socket = connectSocket();

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callIdRef = useRef("");

  const callModeRef = useRef<"voice" | "video">(initialCallType);

  const outgoingStartedRef = useRef("");
  
  // Stores the actual remote user's ID.
  const remotePeerIdRef = useRef("");

  const remoteAudioAttachedRef = useRef(false);

  const [incomingCall, setIncomingCall] =
    useState<IncomingCall | null>(null);

  const [active, setActive] = useState(false);

  const [mode, setMode] =
    useState<"voice" | "video">(initialCallType);

  const [status, setStatus] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  async function createPeer(
    callId: string,
    callMode: "voice" | "video"
  ) {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peerRef.current = peer;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callMode === "video",
    });

    streamRef.current = stream;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    // Receive remote audio/video.
    peer.ontrack = (event) => {
      const remoteStream =
        event.streams[0] || new MediaStream([event.track]);

      // Process actual incoming audio through Spatial Audio.
      if (
        event.track.kind === "audio" &&
        !remoteAudioAttachedRef.current
      ) {
        const remoteUserId = remotePeerIdRef.current;

        if (remoteUserId) {
          spatialAudio.addPeerAudio(
            remoteUserId,
            remoteStream
          );

          remoteAudioAttachedRef.current = true;
        }
      }

      // Display remote video without playing its audio twice.
      if (event.track.kind === "video" && videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.muted = true;

        void videoRef.current.play().catch((error) => {
          console.error("Remote video playback failed:", error);
        });
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("call:ice", {
          callId,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setStatus("Connected");
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        setStatus("Connection interrupted");
      }
    };

    return peer;
  }

  async function flushIce() {
    const peer = peerRef.current;

    if (!peer?.remoteDescription) return;

    for (const candidate of pendingIceRef.current) {
      await peer.addIceCandidate(candidate);
    }

    pendingIceRef.current = [];
  }

  function stopMedia() {
    // Clean up spatial audio for this remote user.
    if (remotePeerIdRef.current) {
      spatialAudio.removePeerAudio(remotePeerIdRef.current);
    }

    remoteAudioAttachedRef.current = false;
    remotePeerIdRef.current = "";

    peerRef.current?.close();
    peerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
    pendingIceRef.current = [];

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function finishCall(message: string) {
    stopMedia();

    callIdRef.current = "";

    setActive(false);
    setIncomingCall(null);
    setMuted(false);
    setCameraOff(false);
    setStatus(message);

    outgoingStartedRef.current = "";
  }

  async function acceptIncoming() {
    if (!incomingCall) return;

    const selectedCall = incomingCall;

    try {
      callIdRef.current = selectedCall.callId;

      callModeRef.current = selectedCall.mode;

      // Incoming caller's actual ID.
      remotePeerIdRef.current = selectedCall.caller.id;

      setMode(selectedCall.mode);

      await createPeer(
        selectedCall.callId,
        selectedCall.mode
      );

      socket.emit("call:accept", {
        callId: selectedCall.callId,
      });

      setIncomingCall(null);
      setActive(true);
      setStatus("Connecting...");
    } catch (error) {
      stopMedia();

      setStatus(
        "Microphone/camera permission denied or unavailable."
      );

      socket.emit("call:reject", {
        callId: selectedCall.callId,
      });

      setIncomingCall(null);

      console.error(error);
    }
  }

  function rejectIncoming() {
    if (!incomingCall) return;

    socket.emit("call:reject", {
      callId: incomingCall.callId,
    });

    setIncomingCall(null);
    setStatus("Call rejected.");
  }

  async function startOutgoingCall(userId: string) {
    if (!userId) return;

    // Outgoing call's remote user ID.
    remotePeerIdRef.current = userId;

    callModeRef.current = initialCallType;

    setMode(initialCallType);
    setStatus("Calling...");
    setActive(true);

    socket.emit("call:invite", {
      targetUserId: userId,
      mode: initialCallType,
    });
  }

  function hangUp() {
    const callId = callIdRef.current;

    if (callId) {
      socket.emit("call:leave", { callId });
    }

    finishCall("Call ended.");

    onClose();
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];

    if (!track) return;

    track.enabled = !track.enabled;

    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks()[0];

    if (!track) return;

    track.enabled = !track.enabled;

    setCameraOff(!track.enabled);
  }

  useEffect(() => {
    const onIncoming = (data: IncomingCall) => {
      callIdRef.current = data.callId;

      callModeRef.current = data.mode;

      setIncomingCall(data);
      setMode(data.mode);
      setStatus("");
    };

    const onOutgoing = (data: { callId: string }) => {
      callIdRef.current = data.callId;

      setStatus("Ringing... Waiting for answer.");
    };

    const onAccepted = async (data: { callId: string }) => {
      try {
        callIdRef.current = data.callId;

        const selectedMode = callModeRef.current;

        const peer = await createPeer(
          data.callId,
          selectedMode
        );

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("call:offer", {
          callId: data.callId,
          offer,
        });

        setStatus("Connecting...");
      } catch (error) {
        console.error(error);
        setStatus("Unable to start media connection.");
      }
    };

    const onOffer = async (data: {
      callId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        const peer = peerRef.current;

        if (!peer) return;

        await peer.setRemoteDescription(data.offer);

        await flushIce();

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socket.emit("call:answer", {
          callId: data.callId,
          answer,
        });

        setStatus("Connecting...");
      } catch (error) {
        console.error(error);
        setStatus("Unable to answer the call.");
      }
    };

    const onAnswer = async (data: {
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        const peer = peerRef.current;

        if (!peer) return;

        await peer.setRemoteDescription(data.answer);

        await flushIce();

        setStatus("Connected");
      } catch (error) {
        console.error(error);
        setStatus("Connection error.");
      }
    };

    const onIce = async (data: {
      candidate: RTCIceCandidateInit;
    }) => {
      const peer = peerRef.current;

      if (peer?.remoteDescription) {
        try {
          await peer.addIceCandidate(data.candidate);
        } catch (error) {
          console.error("Unable to add ICE candidate.", error);
        }
      } else {
        pendingIceRef.current.push(data.candidate);
      }
    };

    const onRejected = (data?: { reason?: string }) => {
      finishCall(data?.reason || "Call rejected.");
    };

    const onTimeout = () => {
      finishCall("No answer. Call timed out after 30 seconds.");
    };

    const onMissed = () => {
      finishCall("Missed call.");
    };

    const onEnded = () => {
      finishCall("The other employee left the call.");
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:outgoing", onOutgoing);
    socket.on("call:accepted", onAccepted);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:rejected", onRejected);
    socket.on("call:timeout", onTimeout);
    socket.on("call:missed", onMissed);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:outgoing", onOutgoing);
      socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:rejected", onRejected);
      socket.off("call:timeout", onTimeout);
      socket.off("call:missed", onMissed);
      socket.off("call:ended", onEnded);

      stopMedia();
    };
  }, []);

  useEffect(() => {
    if (!targetUserId) {
      outgoingStartedRef.current = "";
      return;
    }

    if (outgoingStartedRef.current === targetUserId) return;

    outgoingStartedRef.current = targetUserId;

    void startOutgoingCall(targetUserId);
  }, [targetUserId]);

  return (
    <>
      {mode === "video" && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="call-remote-video"
        />
      )}

      {incomingCall && (
        <div className="call-overlay">
          <div className="call-card">
            <h2>Incoming {incomingCall.mode} call</h2>

            <h3>
              {incomingCall.caller.displayName ||
                incomingCall.caller.username ||
                "Employee"}
            </h3>

            <p>Someone is calling you...</p>

            <div className="call-actions">
              <button onClick={() => void acceptIncoming()}>
                Accept
              </button>

              <button onClick={rejectIncoming}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="call-active-panel">
          <h3>{targetName || "ProxiSpeak Call"}</h3>

          <p>{status}</p>

          <div className="call-actions">
            <button onClick={toggleMic}>
              {muted ? "Unmute" : "Mute"}
            </button>

            {mode === "video" && (
              <button onClick={toggleCamera}>
                {cameraOff ? "Camera On" : "Camera Off"}
              </button>
            )}

            <button onClick={hangUp}>
              Leave Call
            </button>
          </div>
        </div>
      )}

      {!active && !incomingCall && status && (
        <div className="call-status-toast">
          {status}
        </div>
      )}
    </>
  );
}