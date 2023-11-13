import React, { useEffect, useRef, useState } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './App.css'
import { firebaseConfig } from './firebase';
function App() {

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const firestore = firebase.firestore();

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Global State
  const pc = new RTCPeerConnection(servers);
  let localStream = null;
  let remoteStream = [];

 
  const webcamVideo = useRef(null);
  const callInput = useRef(null);
  const remotevideodiv = useRef(null);
  const [callid, setcallid] = useState('');

  const startWebcam = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = [new MediaStream()];

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.addEventListener('track', (event) => {
      const [stream] = event.streams;

      if (!remoteStream.some((existingStream) => existingStream.id === stream.id)) {
        remoteStream = [...remoteStream, stream];

        // const newRemoteVideo = document.createElement('video');
        // newRemoteVideo.srcObject = stream;
        remotevideodiv.current.srcObject = stream;
        // newRemoteVideo.autoplay = true;
        // newRemoteVideo.playsInline = true;
        // console.log("hello")
        // document.body.appendChild(newRemoteVideo);
      }
    });

    webcamVideo.current.srcObject = localStream;
  };

  const createCall = async () => {
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    callInput.current.value = callDoc.id;
    setcallid(callDoc.id);

    pc.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({ offer });

    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const answerCall = async () => {
    const callId = callInput.current.value;
    const callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');
    console.log("1")
    pc.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    console.log("2")
  };

  useEffect(()=>{
  startWebcam()
  }, [])
  return (

    <body>
      <div className="videos">
        <span>
          <h3>Local Stream</h3>
          <video id="webcamVideo" autoPlay playsInline ref={webcamVideo}></video>
        </span>
        <span>
          <h3>Remote video</h3>
          <video id="remotevideodiv" autoPlay playsInline ref={remotevideodiv}></video>
        </span>

      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', paddingLeft: '100px', paddingRight: '100px' }}>
  <div style={{ alignItems: 'center' }}>
    <h2>Create a new stream</h2>
    <button id="callButton" onClick={createCall}>
      start stream
    </button>
    <p >{callid && `streamID:    ${callid}`}</p>
  </div>
  <div style={{ alignItems: 'center', marginLeft: '100px' }}>
    <h2>Join a stream</h2>
    <p>Join stream from a different browser window or device</p>
    <input id="callInput" ref={callInput} />
    <button id="answerButton" onClick={answerCall}>
      Join A stream
    </button>
  </div>
</div>


    </body>

  );
}

export default App;
