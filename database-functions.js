import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-app.js'
import {getAuth, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-auth.js'
import {getDatabase, child, push, ref, update, get, onValue, onChildAdded, onChildChanged, onChildRemoved, set, off} from 'https://www.gstatic.com/firebasejs/9.2.0/firebase-database.js'
const firebaseConfig = {
  apiKey: "AIzaSyChiEAP1Rp1BDNFn7BQ8d0oGR65N3rXQkE",
  authDomain: "eyesee-d0a42.firebaseapp.com",
  databaseURL: "https://eyesee-d0a42-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "eyesee-d0a42",
  storageBucket: "eyesee-d0a42.appspot.com",
  messagingSenderId: "56834287411",
  appId: "1:56834287411:web:999340ed2fd5165fa68046"
};
let App = null;
let Database = null;
let Auth = null;
let User = null;
let StateListeners = [];

function authChange(user){
  User = user;

  let newListeners = [];
  for (let obj of StateListeners) {
    if (obj instanceof Function) {
      if (obj(user) != "remove") newListeners.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.onauthchange instanceof Function) {
        if (obj.onauthchange(user) != "remove") newListeners.push(obj);
      }
    }
  }

  StateListeners = newListeners;
}

function sessionRef(sessionID, childKey) {
  let sref = null;
  if (Database != null) {
    sref = ref(Database, "sessions/" + sessionID);
    if (typeof childKey === "string") sref = child(sref, childKey);
  }
  return sref;
}
function patientRef(sessionID) {
  let pref = null;
  let uid = getUID();
  if (uid != null) {
    pref = child(sessionRef(sessionID, "patients"), uid);
  }
  return pref;
}
async function isOwner(sessionID){
  let owner = null;
  try {
    owner = (await get(sessionRef(sessionID, "owner"))).val();
  } catch(e) {
    console.log(e);
    owner = null;
  }
  if (owner !== null) {
    owner = owner == getUID();
  }
  return owner;
}

function initializeFirebase(config = firebaseConfig) {
  App = initializeApp(config);
  Database = getDatabase(App);
  Auth = getAuth();
  onAuthStateChanged(Auth, (userData) => {
    if (userData == null) {
      authChange(userData);
    } else {
      if (!(User != null && User.uid === userDat.uid)) {
        authChange(userData);
      }
    }
  });
}


function getUID(){
  let uid = null
  if (User != null) {
    uid = User.uid;
  }
  return uid;
}
function getUser(){
  return User;
}


function addAuthChangeListener(obj) {
  StateListeners.push(obj);
}

function login(){
  const provider = new GoogleAuthProvider();
  console.log(Auth);
  signInWithRedirect(Auth, provider);
}

function logout(){
  Auth.signOut();
}


async function makeSession() {
  let sessionID = null;
  try {
    sessionID = getUID();
    let session = {
      "owner": sessionID,
    }
    let sref = sessionRef(sessionID);
    await set(sref, session);
  } catch(e) {
    console.log(e);
    sessionID = null;
  }
  return sessionID;
}

function joinSessionAsOwner(sessionID, sessionObj) {
  // update session info
  sessionObj.updateInfo = async (info) => {
    try {
      await set(sessionRef(sessionID, "info"), info)
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  // watch for changes in patients directory
  let stop = onValue(sessionRef(sessionID, "patients"), (patients) => {
    if (sessionObj.onpatientinfo instanceof Function) {
      sessionObj.onpatientinfo(patients.val());
    }
  });

  sessionObj.leaveSession = () => {
    stop();
    sessionObj.updateInfo = null;
  }

  sessionObj.isSessionOwner = true;
}

function joinSessionAsPatient(sessionID, sessionObj) {
  sessionObj.updatePatientInfo = async (pinfo) => {
    try {
      await set(patientRef(), pinfo);
      return true;
    } catch(e) {
      console.log(e);
      return false;
    }
  }
  // watch for changes in info call session update on change
  let stop = onValue(sessionRef(sessionID, "info"), (info) => {
    if (sessionObj.oninfo instanceof Function) {
      sessionObj.oninfo(info.val());
    }
  });

  sessionObj.unsubscribeSession = () => {
    stop();
    sessionObj.updatePatientInfo = null;
  }

  sessionObj.isSessionOwner = false;
}

// join a session
async function joinSession(sessionID, sessionObj = {}, forcePatient = false) {
  if (typeof sessionObj !== "object" || sessionObj === null) sessionObj = {};

  let isowner = await isOwner(sessionID);
  if (isowner !== null) {
    if (isowner && !forcePatient) {
      joinSessionAsOwner(sessionID, sessionObj);
      console.log("session joined as owner");
    } else {
      joinSessionAsPatient(sessionID, sessionObj);
      console.log("session joined as patient");

    }
  } else {
    sessionObj = null;
  }

  return sessionObj;
}

initializeFirebase();

export {addAuthChangeListener, login, logout, makeSession, joinSession}
