const passport          = require('passport');
var express             = require('express');
const db                = require('./db');
const crypto            = require('crypto'); 

module.exports = {
    autoLogin: function (req,res,next) {
        req.body.Email = ' '
        req.body.password = ' '
        if(!req.user){
          // next();
          db.query(
              `
                  SELECT USER_ID AS USER_ID
                    FROM AUTO_LOGIN
                  WHERE USER_SID = $1
              `
              ,[req.cookies.sid]
          ).then(
            function(userOne){
              if(userOne.rows.length > 0){
                passport.authenticate('onejumin-auto',{
                  failureRedirect : '/users/login',
                  failureFlash : true
                })(req,res,next)
              }else{
                next();
              }
            }
          )
        }else{
          next();
        }
    }
};
