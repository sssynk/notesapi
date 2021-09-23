// load api e
const express = require('express');
const api = express();
const AES = require("crypto-js/aes");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({windowMs: 15 * 60 * 1000, max: 25});

const mysql = require('mysql');
const con = mysql.createConnection({
  host: "localhost",
  user: "jamesw",
  password: "J-wilson123",
  database: "moreusers"
});

function authUser(authToken, request, callback) {
  var complete = false;
  con.query("SELECT token, internal_token FROM users", function (err, result, fields) {
    if (request.headers.origin != "https://james.baby") {
    if (err) throw err;
    const users = result;
    var success = false;
    for(const user in users) {
        if((users[user].token) == (authToken)) {
          success = true;
        };
    }
    callback(success);
    return success;
  } else {
    if (err) throw err;
    const users = result;
    var success = false;
    for(const user in users) {
        if((users[user].internal_token) == (authToken)) {
          success = true;
        };
    }
    callback(success);
    return success;
  }
  });
}

api.use(cors())
api.use(express.json());
api.use("/s/internal/", function(req, res, next) {
  if(req.headers.origin == "https://james.baby") {
    next();
  } else {
    res.status(403).send({status: 403, message: "Forbidden"})
  }
});

api.use("/s/newuser", limiter);

api.post('/s/newuser', function(req, res) {
 if(req.body.username && req.body.password) {
  con.query("SELECT username FROM users", function (err, result, fields) {
    if (err) throw err;
    const usernames = result;
    var failed = false;
    for(const user in usernames) {
        if((usernames[user].username.trim()) == (req.body.username.trim())) {
          failed = true;
        }
    }
    if(failed) {
     res.status(409).send({status: 409, message: "A user with this username already exists."});
    } else {
     var rtoken = AES.encrypt(req.body.username, req.body.password).toString();
     con.query("INSERT INTO users (username, password, token) VALUES (\'"+req.body.username+"\', \'"+req.body.password+"\', \'"+rtoken+"\');", function(err, result, fields) {
        if (err) throw err;
        res.status(201).send({status: 201, token: rtoken});
     });
    }
  });
} else {
  res.status(418).send({status: 418, message: "Error, username or password wasn't included in request."});
 };
});


api.get('/s/internal/login', function(req, res) {
var username = req.query.username;
var password = req.query.password;
if(username != undefined && password != undefined) {
  con.query("SELECT username, password, token FROM users", function (err, result, fields) {
    if (err) throw err;
    const users = result;
    var token = null;
    var authenticated = false;
    for(const user in users) {
        if((users[user].username.trim() == username.trim()) && (users[user].password == password)) {
          authenticated = true;
        };
    }
    if(authenticated == true) {
      const internal_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      con.query("UPDATE users SET internal_token = \'"+internal_token+"\' WHERE username = \'"+username+"\'", function(err, result, fields) {
        if(err) throw err;
        token = internal_token.toString();
        res.status(200).send({status: 200, internal_token: token});
      });
    } else {
      res.status(401).send({status: 401, message: "Invalid username or password!"});
    }
  });
} else {
  res.status(401).send({status: 401, message: "Username or password isn't included in request!"});
}
});

api.use(function(req, res, next) {
 if(!req.headers.authorization) {
  res.status(401).send({status: 401, message: "No authorization header sent."});
 } else {
  authUser(req.headers.authorization, req, function(authed){
   if(authed) {
    next();
   } else {
    res.status(401).send({status: 401, message: "Unauthorized."});
   }
  });
 }
});

con.connect(function(err) {
  if (err) throw err;
});


api.get('/s/user', function(req, res) {
  con.query("SELECT * FROM users", function (err, result, fields) {
    if (err) throw err;
    var success = false;
    var finalresult = {};
    for(const user in result) {
        if((result[user].token == req.headers.authorization) || ((req.headers.origin == "https://james.baby") && (result[user].internal_token == req.headers.authorization))) {
          finalresult = result[user];
          delete finalresult.token;
          delete finalresult.password;
          delete finalresult.internal_token;
          success = true;
        };
    }
    if(success) {
      res.status(200).send({status: 200, user: finalresult});
    } else {
      res.status(401).send({status: 401, message: "No user was found given the Authorization header."});
    }
  });
});

api.get('/s/notes/:id', function(req, res) {
  if(req.params.id) {
  con.query("SELECT * FROM notes", function (err, results, fields) {
            if (err) throw err;
            var success = false;
            var finalresult = {};
            for(const note in results) {
                if((results[note].note_id == req.params.id)) {
                  finalresult = {noteid: results[note].note_id, title: results[note].title, contents: results[note].contents};
                  success = true;
                };
            }
            if(success) {
              res.status(200).send({status: 200, note: finalresult});
            } else {
              res.status(404).send({status: 404, message: "This note doesn't exist!"});
            }
  });
} else {
  res.status(418).send({status: 418, message: "No note id was given!"});
}
});

api.get('/s/notes', function(req, res) {
  con.query("SELECT * FROM users", function (err, result, fields) {
    if (err) throw err;
    var finalresult = {};
    var success = false;
    for(const user in result) {
        if((result[user].token == req.headers.authorization) || ((req.headers.origin == "https://james.baby") && (result[user].internal_token == req.headers.authorization))) {
          var userid = result[user].userid;
          con.query("SELECT * FROM notes", function (err, results, fields) {
            if (err) throw err;
            var finalresult = [];
            for(const note in results) {
                if((results[note].user_id == userid)) {
                  finalresult.push({noteid: results[note].note_id, title: results[note].title, contents: results[note].contents});
                  success = true;
                };
            }
            if(success) {
              res.status(200).send({status: 200, notes: finalresult});
            } else {
              res.status(200).send({status: 200, message: "The user has no notes!"});
            }
          });
        };
    }
  });
});

api.post('/s/notes', function(req, res) {
  if(req.body.contents) {
    var title = "My New Note";
    if(req.body.title) {
      title = req.body.title;
    }
  con.query("SELECT * FROM users", function (err, result, fields) {
    if (err) throw err;
    for(const user in result) {
        if((result[user].token == req.headers.authorization) || ((req.headers.origin == "https://james.baby") && (result[user].internal_token == req.headers.authorization))) {
          var userid = result[user].userid;
          var noteid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          con.query("INSERT INTO notes (note_id, user_id, title, contents) VALUES ('"+noteid+"', '"+userid+"', '"+title+"', '"+req.body.contents+"');", function (err, results, fields) {
            if (err) throw err;
              res.status(201).send({status: 201, note_id: noteid});
          });
        };
    }
  });
} else {
  res.status(418).send({status: 418, message: "The note requires contents!"});
}
});

api.put('/s/notes/:id', function(req, res) {
  if(req.body.contents && req.params.id) {
  con.query("SELECT * FROM users", function (err, result, fields) {
    if (err) throw err;
    for(const user in result) {
        if((result[user].token == req.headers.authorization) || ((req.headers.origin == "https://james.baby") && (result[user].internal_token == req.headers.authorization))) {
          var userid = result[user].userid;
          var noteid = req.params.id;
          var success = false;
          con.query("SELECT * FROM notes", function (err, results, fields) {
            for(const note in results) {
              if((results[note].user_id == userid) && (results[note].note_id == noteid)) {
                success = true;
                if(req.body.title) {
                  con.query("UPDATE notes SET contents = '"+req.body.contents+"', title = '"+req.body.title+"' WHERE note_id = '"+noteid+"';", function (err, resultf, fields) {
                    if(err) throw err;
                    res.status(204).send();
                  });
                } else {
                  con.query("UPDATE notes SET contents = '"+req.body.contents+"' WHERE note_id = '"+noteid+"';", function (err, resultf, fields) {
                    if(err) throw err;
                    res.status(204).send();
                  });
                }
              }
            }
            if(!success) {
              res.status(404).send({status: 404, message: "This note doesn't exist!"});
            }
          });
        };
    }
  });
} else {
  res.status(418).send({status: 418, message: "The note requires contents and an id!"});
}
});


api.listen(5000, () => {
  console.log("API is running :D");
})
