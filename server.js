const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// setup the http server
const httpServer = http.createServer();

// configure the server
const io = new Server(httpServer, {
  cors: {
    origins: ["http://localhost:3000","https://edu-cursor.vercel.app/"],
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

// Generate Light Colors
function generateLightColor() {
  while (true) {
    // Generate random RGB values between 180 and 255
    const r = Math.floor(Math.random() * 75) + 180;
    const g = Math.floor(Math.random() * 75) + 180;
    const b = Math.floor(Math.random() * 75) + 180;

    // Calculate luminance using YIQ formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Check if luminance is high enough for contrast
    if (luminance > 0.7) {
      // Convert RGB values to hex string
      const hexColor = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return hexColor;
    }
  }
}


// The Data Stores
var rooms = new Map()
var user_room = new Map()
var code = new Map()
var users = []

// on connection events are : 
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Creating Room
  socket.on("create_room", (data) => {
    // if room does not exit then only create the room
    if (!rooms.get(data.room)) {
      // if the name is already taken and live
      if (users.includes(data.name)) {
        // emit if the name is there
        socket.emit('error', `This Name Is Already Taken`);
        console.log("error")
      }
      // if user does not exit then only create the room
      else {
        // join the room
        socket.join(data.room);

        // a member created like - Map("socket.id" -> {x:number,y:number,name:string,color:string})
        var member = new Map()
        member.set(socket.id, {
          x: 0,
          y: 0,
          name: data.name,
          color: generateLightColor()
        })
        // Assigned to rooms like - Map("Room Name"->member)
        rooms.set(data.room, member)

        // setting the id -> room
        user_room.set(socket.id, data.room)

        // setting the initial code room_name -> code
        code.set(socket.id, { code: "", lang: "javascript" })

        // setting user to users for no duplication
        users.push(data.name)

        // after creation send message to the user
        io.to(socket.id).emit('message', { msg: "Created The Room", data: socket.id })
      }
    }
    else {
      // if Room Already Exits then send msg
      socket.emit('error', `Room Already Exits`);
      console.log("error", `Room Already Exits`)
    }

    // printing the important messages
    console.log(rooms, user_room, users)
  });

  // Joining Room
  socket.on("join_room", (data) => {
    // if room does not exit then only join the room
    if (rooms.get(data.room)) {
      // if name is not already taken
      if (users.includes(data.name)) {
        // send the message if name is taken
        socket.emit('error', `This Name Is Already Taken`);
        console.log("error", `This Name Is Already Taken`)
      }
      // if name is available then
      else {
        // join the room
        socket.join(data.room);

        // add member to room with room name given
        rooms.get(data.room)
          .set(socket.id, {
            x: 0,
            y: 0,
            name: data.name,
            color: generateLightColor()
          })

        // set user -> room
        user_room.set(socket.id, data.room)

        // add to users for duplicate remove
        users.push(data.name)

        // send join message to the user
        io.to(socket.id).emit('message', { msg: "Joined The Room", data: socket.id })
      }
    }
    else {
      // send error message if room is not there
      socket.emit('error', `No Room Id - ${data.room}`);
      console.log("error", `No Room Id - ${data.room}`)
    }

    // printing the important messages
    console.log(rooms, user_room, users)
  });

  // Update Cursors
  socket.on("update", data => {
    // If Room Is Available then only update can be done
    if (rooms.get(data.room)) {
      // set the cursor data to the id
      rooms.get(data.room)
        .set(socket.id, {
          ...rooms.get(data.room).get(socket.id),
          x: data.cursor.x,
          y: data.cursor.y
        })

      // send updated data to the room members
      io.to(data.room).emit("update", Object.fromEntries(rooms.get(data.room)));
    }
    else {
      // send messages if error to the user
      socket.emit('error', `No Room Id - ${data.room}`);
      console.log("error", `No Room Id - ${data.room}`)
    }
  })

  // Update Code 
  socket.on("update_code", data => {
    // If room is available only
    if (rooms.get(data.room)) {
      // set Code like room -> code
      code.set(data.room, { ...code.get(data.room), code: data.code })

      // Emit to the room users
      io.to(data.room).except(socket.id).emit("update_code", code.get(data.room));
    }
    else {
      // send error messages to the user
      socket.emit('error', `No Room Id - ${data.room}`);
      console.log("error", `No Room Id - ${data.room}`)
    }
  })

  // Update Language
  socket.on("update_lang", data => {
    // If room is available only
    if (rooms.get(data.room)) {
      // set Language like room -> code
      code.set(data.room, { ...code.get(data.room), lang: data.lang })

      // Emit to the room users
      io.to(data.room).except(socket.id).emit("update_lang", code.get(data.room));
    }
    else {
      // send error messages to the user
      socket.emit('error', `No Room Id - ${data.room}`);
      console.log("error", `No Room Id - ${data.room}`)
    }
  })

  // Leaving Room
  socket.on('leave_room', (data) => {
    // If Room is there and User Is there in the room
    if (rooms.get(data.room) && rooms.get(data.room).get(socket.id)) {
      // getting the id and delete the member from room
      rooms.get(data.room).delete(socket.id)

      // also delete the user from users and user_room
      user_room.delete(socket.id)
      users = users.filter(e => e != data.name)

      // delete the room if the room is empty
      if (rooms.get(data.room).size == 0) {
        rooms.delete(data.room)
        code.delete(data.room)
      }

      // leave from the room
      socket.leave(data.room)
    }

    // logging some important information
    console.log(rooms, user_room, users)
  })

  // Disconnection
  socket.on("disconnecting", (reason) => {
    // getting the room id from the user_room map
    let room_from_id = user_room.get(socket.id)

    // if room is there and also the user is available
    if (rooms.get(room_from_id) && rooms.get(room_from_id).get(socket.id)) {
      // remove the user from the users group 
      users = users.filter(e => e != rooms.get(room_from_id).get(socket.id).name)

      // remove the member from the room and the user
      rooms.get(room_from_id).delete(socket.id)
      user_room.delete(socket.id)

      // if the room is empty then delete it
      if (rooms.get(room_from_id).size == 0) {
        rooms.delete(room_from_id)
        code.delete(room_from_id)
      }

      // leave from the room
      socket.leave(room_from_id)
    }

    // logging some important information
    console.log(rooms, user_room, users)
  });
});

// Starting the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server is running on port ${PORT}`);
});