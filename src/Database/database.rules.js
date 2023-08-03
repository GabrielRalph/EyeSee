{
  write: is_creator,
  read: is_creator,
  info: {
    read: true,
    mousex: {validate: number},
    mousey: {validate: number},
    width: {validate: number},
    height: {validate: number},
    info: {validate: number},
  },
  patients: {
    $uid: {
      write: user.uid == $uid,
      name: {validate: name},
      eyex: {validate: number},
      eyey: {validate: number}
    }
  }
}
