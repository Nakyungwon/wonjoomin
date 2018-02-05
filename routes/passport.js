const passport          = require('passport');
const LocalStrategy     = require('passport-local').Strategy;
const db                = require('./db');
const crypto            = require('crypto'); 

  passport.serializeUser((user, done) => { 
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    db.query(
        `
        SELECT USER_ID
              ,NICK_NAME
              ,USER_GRADE
         FROM ONEJUMIN_USER
        WHERE USER_ID   = $1
        `
        ,[user]
    ).then(user_info => {
        done(null,user);
    })
  });

  passport.use('onejumin-login',
   new LocalStrategy({ // local 전략을 세움
    usernameField: 'Email',
    passwordField: 'password',
    session: true, // 세션에 저장 여부
    passReqToCallback: true,
  }, (req, Email, password, done) => {
    let c_password = crypto.createHash('sha512').update(password).digest('base64');
    db.query(
        `
        SELECT A.USER_ID
              ,A.NICK_NAME
              ,A.USER_GRADE
              ,(
                 SELECT COUNT(*)
                   FROM USER_IP_BAN B
                  WHERE A.USER_ID = B.USER_ID
                    AND timezone('KST'::text, now()) > B.START_DATE
                    AND timezone('KST'::text, now()) < B.END_DATE
               ) BAN_YN
               ,(
                SELECT TO_CHAR(END_DATE,'YYYY-MM-DD HH24:MI:SS')
                  FROM USER_IP_BAN B
                 WHERE A.USER_ID = B.USER_ID
                   AND timezone('KST'::text, now()) > B.START_DATE
                   AND timezone('KST'::text, now()) < B.END_DATE
               ) END_DATE
         FROM ONEJUMIN_USER A
        WHERE A.USER_ID        = $1
          AND A.USER_PASSWORD  = $2 
        `
        ,[Email,c_password]
    ).then(user_info => {
        if(user_info.rows.length === 0){
            return done(null,false,req.flash('errMsg','아이디 또는 비밀번호가 일치하지 않습니다.'));
        }else if(user_info.rows[0].ban_yn > 0){
            return done(null,false,req.flash('errMsg','아이디가 정지되었습니다. 정지 해제 시간 : '+user_info.rows[0].end_date));
        }else{
            return done(null,user_info.rows[0]);
        }
    })
  }));

  passport.use('onejumin-auto',
  new LocalStrategy({ // local 전략을 세움
    usernameField: 'Email',
    passwordField: 'password',
    session: true, // 세션에 저장 여부
    passReqToCallback: true,
 }, (req, Email, password, done) => {
    if(!req.user){
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
                  db.query(
                    `
                    SELECT A.USER_ID
                          ,A.NICK_NAME
                          ,A.USER_GRADE
                          ,(
                            SELECT COUNT(*)
                              FROM USER_IP_BAN B
                              WHERE A.USER_ID = B.USER_ID
                                AND timezone('KST'::text, now()) > B.START_DATE
                                AND timezone('KST'::text, now()) < B.END_DATE
                          ) BAN_YN
                          ,(
                            SELECT TO_CHAR(END_DATE,'YYYY-MM-DD HH24:MI:SS')
                              FROM USER_IP_BAN B
                            WHERE A.USER_ID = B.USER_ID
                              AND timezone('KST'::text, now()) > B.START_DATE
                              AND timezone('KST'::text, now()) < B.END_DATE
                          ) END_DATE
                    FROM ONEJUMIN_USER A
                    WHERE A.USER_ID        = $1
                    `
                    ,[userOne.rows[0].user_id]
                ).then(user_info => {
                    if(user_info.rows.length === 0){
                        return done(null,false);
                    }else if(user_info.rows[0].ban_yn > 0){
                        return done(null,false);
                    }else{
                        return done(null,user_info.rows[0]);
                    }
                })
             }else{
                return done(null,false);
             }
           }
         )
     }
 }));
  
  module.exports = passport;
