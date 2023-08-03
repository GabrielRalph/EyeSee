import {isOwner, setUserData, getUserData, setSession, getSession, onValuePatient, onValueSession, setPatient} from "./database-functions.js"

let UpdateHandlers = [];
function update(type, value) {
  for (let callback of UpdateHandlers) {
    callback(type, value);
  }
}
export function addUpdateHandler (callback) {
  if (callback instanceof Function) {
    UpdateHandlers.push(callback);
  }
}

let SID = null;
let IsPatient = true;
let Detatchers = [];
export async function joinSession(sessionID, patient){
  try {
    console.log(sessionID);
    let pdf = await getSession(sessionID, "info/pdf");
    if (pdf == null) throw "Invalid session key"
  } catch (e) {
    console.log(e);
    throw "Invalid session";
  }

  let owner = await isOwner(sessionID);
  SID = sessionID;
  IsPatient = patient || !owner;
  for (let detatch of Detatchers) detatch();

  let detatchers = [
    onValueSession(SID, "info/pdf", (sc) => {
      update("pdf", sc.val());
    })
  ];

  if (IsPatient) {
    let moused = onValueSession(SID, "info/mouse", (sc) => {
      update("mouse", sc.val());
    });
    detatchers.push(moused);
  }

  if (!IsPatient) {
    let patientsd = onValueSession(SID, "patients", (sc) => {
      update("eyes", sc.val());
    })
    detatchers.push(patientsd)
  }

  setUserData("info/current-session", SID);

  Detatchers = detatchers;
}

export const broadcast = {
   mouse: async function(position) {
     if (!IsPatient && SID) {
       try {
         if (position != null) {
           let {x, y} = position;
           position = {x, y}
         }
         await setSession(SID, "info/mouse", position);
       } catch (e) {}
     }
   },
   eye: async function(position) {
     if (SID) {
       try {
         if (position != null) {
           let {x, y} = position;
           position = {x, y}
         }
         await setPatient(SID, "eyes", position);
       } catch (e) {}
     }
   },
   page: async function(page) {
     if (!IsPatient && SID) {
       try {
         await setSession(SID, "info/pdf/page", page);
       } catch (e) {}
     }
   },
}
