var express    = require('express');
var db         = require('./db');
var nodemailer = require('nodemailer'); //smtp 메일 전송
var jwt        = require('jsonwebtoken'); //이메일인증용 토큰
var crypto     = require('crypto'); //암호화
var moment     = require('moment'); //시간 
var passport   = require('./passport');
var autoLogin  = require('./autoLogin');
var fs         = require('fs');
var multer     = require('multer');
var path       = require('path');
var ipaddr     = require('ipaddr.js');
var upload     = multer({ 
                    limits : { fileSize: 10 * 1024 * 1024},
                    storage: multer.diskStorage({
                      destination: function (req, file, cb) {
                        cb(null, 'public/user_photo/');
                      },
                      filename: function (req, file, cb) {
                        cb(null, new Date().valueOf() + path.extname(file.originalname));
                      },
                    }),
                }).single('user_photo');
moment.locale('ko');
var router = express.Router();

/**
 * 내가 쓴글 리스트 공통(리스트 화면 , 상세 밑에)
 */
const boardList = async function(req, res, next){
  var page = 1;
  var pg = req.param("pg");    			    	
  if(pg != null && !pg == ""){
    page = Number(pg);
  }
  var field = req.param("search") == null ?'':req.param("search");
  var srow = 0+ (page-1)*15;

  const boardList = await db.query(
    `SELECT BOARD_SEQ               AS BOARD_SEQ       
            ,BOARD_CATEGORY_CODE    AS BOARD_CATEGORY_CODE
            ,BOARD_TITLE            AS BOARD_TITLE
            ,BOARD_CONTENT          AS BOARD_CONTENT 
            ,USER_ID                AS USER_ID   
            ,NICK_NAME              AS NICK_NAME   
            ,CREATE_DATE            AS CREATE_DATE
            ,SM_MENU_ID             AS SM_MENU_ID
            ,BOARD_HITS             AS BOARD_HITS
            ,(SELECT SM_MENU_ABB     
                FROM SM_MENU B
              WHERE B.SM_MENU_ID   = A.SM_MENU_ID
            )                       AS SM_MENU_ABB
            ,(SELECT MENU_GBN     
                FROM SM_MENU B
             WHERE B.SM_MENU_ID   = A.SM_MENU_ID
            )                       AS MENU_GBN
            ,(SELECT COUNT(*)     
                FROM BOARD_STATUS B
               WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                 AND B.COMMENT_SEQ        IS NULL
                 AND B.BOARD_GBN          = 'G'
                 AND B.SM_MENU_ID         = A.SM_MENU_ID
             )                      AS GOOD_GBN
            ,(SELECT COUNT(*) 
                FROM BOARD_STATUS B
               WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                 AND B.COMMENT_SEQ        IS NULL
                 AND B.BOARD_GBN          = 'B'
                 AND B.SM_MENU_ID         = A.SM_MENU_ID
             )                      AS BAD_GBN
       FROM BOARD A
      WHERE USER_ID = $1
        AND USE_YN = 'Y'
        AND (
                 BOARD_TITLE   LIKE '%'||$3||'%'
              OR BOARD_CONTENT LIKE '%'||$3||'%'
            )
      ORDER BY CREATE_DATE DESC
      LIMIT 15 OFFSET $2
    `
    ,[req.user.user_id,srow,field]
  )

  const pageList = await db.query(
    `SELECT COUNT(*) CNT
       FROM BOARD
      WHERE USER_ID = $1
        AND USE_YN = 'Y'
        AND (
                  BOARD_TITLE   LIKE '%'||$2||'%'
              OR BOARD_CONTENT LIKE '%'||$2||'%'
            )
    `
    ,[req.user.user_id,field]
  )

  var cnt   = pageList.rows[0].cnt;
  var start = page - (page-1)%5;  
  var end   = Math.floor(cnt/15) + (cnt%15 == 0?0:1);

  for(var i = 0 ; i < boardList.rows.length ; i ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(boardList.rows[i].create_date).format('YYYYMMDD')){
      boardList.rows[i].create_date = moment(boardList.rows[i].create_date).fromNow();
    }else{
      boardList.rows[i].create_date = moment(boardList.rows[i].create_date).format('YYYY-MM-DD');
    }
  }

  var rtnJson = {
                  boardList    : boardList.rows
                  ,sm_menu_id  : req.param('sm_menu_id')
                  ,cnt         : cnt
                  ,pg          : page
                  ,search      : field
                  ,start       : start
                  ,end         : end
              }

  return rtnJson;
}

/**
 * 와드 박은 글 리스트 공통(리스트 화면 , 상세 밑에)
 */
const wardList = async function(req, res, next){
  var page = 1;
  var pg = req.param("pg");    			    	
  if(pg != null && !pg == ""){
    page = Number(pg);
  }
  var field = req.param("search") == null ?'':req.param("search");
  var srow = 0+ (page-1)*15;

  const wardList = await db.query(
    `SELECT A.BOARD_SEQ               AS BOARD_SEQ       
            ,A.BOARD_CATEGORY_CODE    AS BOARD_CATEGORY_CODE
            ,A.BOARD_TITLE            AS BOARD_TITLE
            ,A.BOARD_CONTENT          AS BOARD_CONTENT 
            ,A.USER_ID                AS USER_ID   
            ,A.NICK_NAME              AS NICK_NAME   
            ,A.CREATE_DATE            AS CREATE_DATE
            ,A.SM_MENU_ID             AS SM_MENU_ID
            ,A.BOARD_HITS             AS BOARD_HITS
            ,(SELECT SM_MENU_ABB     
                FROM SM_MENU B
              WHERE B.SM_MENU_ID   = A.SM_MENU_ID
            )                         AS SM_MENU_ABB
            ,(SELECT MENU_GBN     
                FROM SM_MENU B
                WHERE B.SM_MENU_ID   = A.SM_MENU_ID
            )       
            ,(SELECT COUNT(*)     
                FROM BOARD_STATUS B
               WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                 AND B.COMMENT_SEQ        IS NULL
                 AND B.BOARD_GBN          = 'G'
                 AND B.SM_MENU_ID         = A.SM_MENU_ID
             )                      AS GOOD_GBN
            ,(SELECT COUNT(*) 
                FROM BOARD_STATUS B
               WHERE B.BOARD_SEQ          = A.BOARD_SEQ
                 AND B.COMMENT_SEQ        IS NULL
                 AND B.BOARD_GBN          = 'B'
                 AND B.SM_MENU_ID         = A.SM_MENU_ID
             )                      AS BAD_GBN
       FROM BOARD A,
            WARD_BOARD B
      WHERE A.SM_MENU_ID = B.SM_MENU_ID
        AND A.BOARD_SEQ  = B.BOARD_SEQ
        AND B.USER_ID = $1
        AND A.USE_YN = 'Y'
        AND (
                 A.BOARD_TITLE   LIKE '%'||$3||'%'
              OR A.BOARD_CONTENT LIKE '%'||$3||'%'
            )
      ORDER BY B.CREATE_DATE DESC
      LIMIT 15 OFFSET $2
    `
    ,[req.user.user_id,srow,field]
  )

  const pageList = await db.query(
    `SELECT COUNT(*) CNT
       FROM BOARD A,
            WARD_BOARD B
      WHERE A.SM_MENU_ID = B.SM_MENU_ID
        AND A.BOARD_SEQ  = B.BOARD_SEQ
        AND B.USER_ID = $1
        AND A.USE_YN = 'Y'
        AND (
                  A.BOARD_TITLE   LIKE '%'||$2||'%'
              OR  A.BOARD_CONTENT LIKE '%'||$2||'%'
            )
    `
    ,[req.user.user_id,field]
  )

  var cnt   = pageList.rows[0].cnt;
  var start = page - (page-1)%5;  
  var end   = Math.floor(cnt/15) + (cnt%15 == 0?0:1);

  for(var i = 0 ; i < wardList.rows.length ; i ++){
    if(moment(new Date()).format('YYYYMMDD') === moment(wardList.rows[i].create_date).format('YYYYMMDD')){
      wardList.rows[i].create_date = moment(wardList.rows[i].create_date).fromNow();
    }else{
      wardList.rows[i].create_date = moment(wardList.rows[i].create_date).format('YYYY-MM-DD');
    }
  }

  var rtnJson = {
                  wardList    : wardList.rows
                  ,sm_menu_id  : req.param('sm_menu_id')
                  ,cnt         : cnt
                  ,pg          : page
                  ,search      : field
                  ,start       : start
                  ,end         : end
              }

  return rtnJson;
}

/**
 * 로그인 페이지로 이동
 */
router.get('/login', function(req, res, next) {
  res.render("users/login",{errMsg:req.flash('errMsg')});
});

/**
 * 로그아웃
 */
router.get('/logout', async function(req, res, next) {
  if(!req.user){
    res.clearCookie('sid')
    req.logout();
    res.redirect("/");
  }else{
      await db.query(
      `
        DELETE 
          FROM AUTO_LOGIN
        WHERE USER_SID = $1
          AND USER_ID  = $2
      `
      ,[req.cookies.sid,req.user.user_id]
    )
    res.clearCookie('sid')
    req.logout();
    res.redirect("/");
  }
});


/**
 * 로그인 체크
 */
router.post('/login', function(req, res, next) {
  next();
}, passport.authenticate('onejumin-login', {
  failureRedirect : '/users/login',
  failureFlash : true
}),function(req, res) {
  const{auto_log,url} = req.body
  var renderPage = url == null ? '/' : url 
  let sbKey = ''
  if(auto_log == 'on'){
    sbKey= String.fromCharCode(((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65))+''+moment(new Date()).format('YYYYMMDDHHmmssSSS')
    res.cookie('sid', crypto.createHash('sha512').update(sbKey).digest('base64'),{
      maxAge: 2592000000
    });
    var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    db.query(
      `
        INSERT INTO AUTO_LOGIN
        (
          USER_SID
          ,USER_ID
          ,CREATE_IP
        )
        VALUES(
          $1
          ,$2
          ,$3
        )
      `
      ,[crypto.createHash('sha512').update(sbKey).digest('base64'),req.user.user_id,ip]
    ).then(
      function(){
        res.redirect(renderPage);
      }
    )
  }else{
    res.redirect(renderPage);
  }
}
)
/**
 * 회원가입페이지로 이동
 */
router.get('/join', function(req, res, next) {
  res.render("users/join");
});

/**
 * 비밀번호 변경페이지로 이동
 */
router.get('/change_password', function(req, res, next) {
  res.render("users/change_password",{user_info   : req.user});
});

/**
 * 이메일 전송(회원가입)
 */
router.post('/email_send', function(req, res, next) {
  let{Email,nickname,password} = req.body

  var f_password = password.substr(0,2)
  for(var i = 0 ; i < password.length-4 ; i ++){
    f_password += '*'
  }
  f_password += password.substr(password.length-2,2);
  var c_password = crypto.createHash('sha512').update(password).digest('base64');

  var tokenKey = "ONEJUMIN";
  var payLoad  = {'Email':Email,'nickname':nickname,'password':c_password,'f_password':f_password};
  var token = jwt.sign(payLoad,tokenKey,{
      algorithm : 'HS256', 
      expiresIn : 120 
  });

  let rawUrl = `http://`+req.get('host')+`/users/auth_email?token=`+token;
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'onejumin12@gmail.com',
      pass: 'sksmssk12!'
    }
  });
  
  let mailOptions = {
    from: '원주민공포만화<onejumin12@gmail.com>',
    to: Email,
    subject: '원주민공포만화 회원가입 인증메일 전송',
    html:`<p>안녕하세요. 원주민 공포 만화입니다.<a href='`+rawUrl+`'>클릭</a> 하시면 인증 완료됩니다.</p>
          <p>페이지가 이동이 안되시면 다음 url을 복사해서 주소창에 붙여 넣어주시기 바랍니다.</p>
          <p>`+rawUrl+`</p>
          `
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
      res.send({msg:'인증메일 전송 Error'});
    } else {
      res.render('users/email_authing')
    }
  });
});

/**
 * 이메일 인증 확인
 */
router.get('/auth_email', function(req, res, next) {
  let token = req.param("token");
  var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
  jwt.verify(token,"ONEJUMIN",function(err,decoded){
    if(err){
      console.log(err)
    }else{
    
      db.query(
          `
            INSERT INTO ONEJUMIN_USER(
              USER_ID      
              ,USER_PASSWORD
              ,NICK_NAME    
              ,USER_GRADE   
              ,CREATE_DATE  
              ,CREATE_IP
              ,FORGET_PASSWORD
            )
            VALUES(
              $1
              ,$2
              ,$3
              ,'SHUDRA'
              ,timezone('KST'::text, now())
              ,$4
              ,$5
            )
          `
          ,
          [decoded.Email,decoded.password,decoded.nickname,ip,decoded.f_password]
        ).then(
          function(){
            res.render('users/email_authed');
          }
        ).catch(e => console.log(e));
    }
  });
 });

/**
 * 이메일 중복체크(회원가입)
 */
router.post('/dub_email', function(req, res, next) {
  const{k_email} = req.body;
  db.query(
    `
      SELECT COUNT(*) AS CNT
        FROM ONEJUMIN_USER
       WHERE USER_ID = $1 
    `
    ,[k_email]
  ).then(function(useYn){
      res.send({useYn : useYn.rows[0].cnt});
  }).catch(function(e){
      console.error(e.stack);
  })
});

/**
 * 닉네임 중복체크(회원가입)
 */
router.post('/dub_nickname', function(req, res, next) {
  const{k_nickname} = req.body;
  db.query(
    `
      SELECT COUNT(*) AS CNT
        FROM ONEJUMIN_USER
       WHERE NICK_NAME = $1 
    `
    ,[k_nickname]
  ).then(function(useYn){
      res.send({useYn : useYn.rows[0].cnt});
  }).catch(function(e){
      console.error(e.stack);
  })
});

/**
 * 내가쓴글 가기
 */
router.get('/mylist', function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    boardList(req, res, next).then(
      function(rtnList){
        res.render('users/mylist',{boardList   : rtnList.boardList
                                  ,sm_menu_id  : req.param('sm_menu_id')
                                  ,cnt         : rtnList.cnt
                                  ,pg          : rtnList.pg
                                  ,search      : rtnList.field
                                  ,start       : rtnList.start
                                  ,end         : rtnList.end
                                  ,user_info   : req.user
                                }
        );
      }
    );
  }
});

/**
 * 와드박은글 가기
 */
router.get('/wardList', function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    wardList(req, res, next).then(
      function(rtnList){
        res.render('users/wardList',{wardList   : rtnList.wardList
                                  ,sm_menu_id  : req.param('sm_menu_id')
                                  ,cnt         : rtnList.cnt
                                  ,pg          : rtnList.pg
                                  ,search      : rtnList.field
                                  ,start       : rtnList.start
                                  ,end         : rtnList.end
                                  ,user_info   : req.user
                                }
        );
      }
    );
  }
});

/**
 * 내가정보 보기
 */
router.get('/myinfo', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    const info = await db.query(
      `
        SELECT NICK_NAME
               ,USER_GRADE
          FROM ONEJUMIN_USER
         WHERE USER_ID = $1
      `
      ,[req.user.user_id]
    )
    res.render('users/myinfo',{info : info.rows[0],user_info   : req.user});
  }
});

/**
 * 개인정보 변경시 비밀번호 체크
 */
router.post('/cfm_password', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    const {k_password} = req.body;
    const password_yn = await db.query(
      `
        SELECT COUNT(*) AS CNT
          FROM ONEJUMIN_USER
         WHERE USER_ID = $1
           AND USER_PASSWORD = $2
      `
      ,[req.user.user_id
       ,crypto.createHash('sha512').update(k_password).digest('base64')
      ]
    )
    res.send({password_yn:password_yn.rows[0]});
  }
});


/**
 * 개인정보 변경
 */
router.post('/upt_user', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    const {password} = req.body;
    const password_yn = await db.query(
      `
        UPDATE ONEJUMIN_USER SET
        USER_PASSWORD = $1
        WHERE USER_ID = $2
      `
      ,[crypto.createHash('sha512').update(password).digest('base64')
        ,req.user.user_id
      ]
    )
    res.redirect('/');
  }
});

/**
 * 비밀번호 잃어버렸을 때 이메일 전송
 */
router.post('/forgot_password',  function(req, res, next) {
    const{k_email}  = req.body
    db.query(
      `
        SELECT FORGET_PASSWORD AS FORGET_PASSWORD
          FROM ONEJUMIN_USER
         WHERE USER_ID = $1
      `
      ,[k_email]
    ).then(
      function(forget_password){
        if(forget_password.rows.length === 0){
          res.send({msg:'등록되지 않은 이메일 입니다.'});
        }
        let transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'onejumin12@gmail.com',
            pass: 'sksmssk12!'
          }
        });
        
        let mailOptions = {
          from: '원주민공포만화<onejumin12@gmail.com>',
          to: k_email,
          subject: '원주민공포만화 비밀번호 찾기 전송',
          html:`<p>안녕하세요. 원주민 공포 만화입니다. 회원님의 비밀번호는 `+forget_password.rows[0].forget_password+` 입니다.</p>
                `
        };
        
        transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            console.log(error);
            res.send({msg:'이메일 전송에 실패하였습니다.'});
          } else {
            res.send({msg:'이메일이 전송 되었습니다.'})
          }
        });
      }
    )
});

/**
 * 회원탈퇴
 */
router.post('/leave_user', async function(req, res, next) {
  const{old_password} = req.body
  if(!req.user){
    res.render('main/error',{msg:'로그인 후에 사용 가능합니다.',user_info   : req.user});
  }else{
    const fCheck = await db.query(
      `
        SELECT COUNT(*) cnt
          FROM ONEJUMIN_USER
        WHERE USER_ID  = $1
          AND USER_PASSWORD = $2
      `
      ,[req.user.user_id,crypto.createHash('sha512').update(old_password).digest('base64')]
    )
    if(Number(fCheck.rows[0].cnt) > 0 ){
      await db.query(
        `
          DELETE FROM ONEJUMIN_USER
          WHERE USER_ID  = $1
            AND USER_PASSWORD = $2
        `
        ,[req.user.user_id,crypto.createHash('sha512').update(old_password).digest('base64')]
      )
      await db.query(
        `
          DELETE 
            FROM AUTO_LOGIN
          WHERE USER_SID = $1
            AND USER_ID  = $2
        `
        ,[req.cookies.sid,req.user.user_id]
      )
      res.clearCookie('sid')
      req.logout();
      res.redirect("/");
    }else{
      res.render('main/error',{msg:'로그인 후에 사용 가능합니다.',user_info   : req.user});
    }
  }
});

/**
 * 개인정보 변경
 */
router.post('/upt_nick',  function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user});
  }else{
    const{nickname} = req.body
    console.log(nickname)
    var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    db.query(
      `
        SELECT COUNT(*) CNT
               ,(
                 SELECT TO_CHAR(MAX(CREATE_DATE) + interval  '2 months','YYYY-MM-DD HH:MI:SS')
                   FROM USER_UPT_LOG
                  WHERE CREATE_DATE >= timezone('KST'::text, now()) - interval  '2 months'
                    AND USER_ID = $1
               ) AS CREATE_DATE
          FROM USER_UPT_LOG
         WHERE USER_ID = $1
           AND CREATE_DATE >= timezone('KST'::text, now()) - interval  '2 months'
      `
      ,[ req.user.user_id ]
    ).then(
      function(cntList){
        if(cntList.rows[0].cnt > 0){
          res.send({msg : '2개월에 한 번씩 닉네임을 변경 할 수 있습니다. \n다음 쿨타임 :'+ cntList.rows[0].create_date})
        }else{
          db.query(
            `
              INSERT INTO USER_UPT_LOG(
                USER_ID    
                ,NICK_NAME  
                ,CREATE_DATE
                ,CREATE_IP  
              )VALUES(
                $1
                ,$2
                ,timezone('KST'::text, now())
                ,$3
              )
            `
            ,[
              req.user.user_id
              ,nickname
              ,ip
            ]
          ).then(
            function(){
              db.query(
                `
                  UPDATE ONEJUMIN_USER SET
                  NICK_NAME = $1
                  WHERE USER_ID = $2
                `
                ,[ nickname,req.user.user_id ]
              ).then(
                function(){
                  req.user.nick_name = nickname;
                  res.send({msg : '번경이 완료되었습니다. 2개월뒤에 닉네임 변경이 가능합니다'})
                }
              )
            }
          )
        }
      }
    )
  }
});

/**
 * 회원사진 업로드 팝업창
 */
router.get('/user_photo', function(req, res, next) {
  res.render("users/user_photo",{user_info:req.user});
});

/**
 * 회원사진 업로드 (등록,수정,삭제)
 */
router.post('/user_photo', function(req, res, next) {
  upload(req, res, function (err) {
    const{del_photo} = req.body
    //들어오면 일단 삭제
    fs.exists('public'+req.user.user_photo, function (exists) { 
        if(exists){
          fs.unlink('public'+req.user.user_photo, function (err) { 
          });
        }
    });
    // 이미지 삭제 chkeck박스 클릭시
    if(del_photo){
      db.query(
        `
          UPDATE ONEJUMIN_USER SET
          USER_PHOTO = NULL
          WHERE USER_ID = $1
        `
        ,[
          req.user.user_id
        ]
      ).then(
        function(){
          req.user.user_photo = null;
          res.render("users/user_photo",{user_info:req.user})
        }
      )
    //이미지 변경및 추가시
    }else{
      if(err){
        res.render("users/user_photo",{msg:'이미지변경 실패',user_info:req.user});
      }else{
          let imgPath      = '\\'+req.file.path.split('\\')[1]+'\\'+req.file.path.split('\\')[2];
          //let imgPath      = '/'+req.file.path.split('/')[1]+'/'+req.file.path.split('/')[2];
          var ip           =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
          db.query(
            `
              UPDATE ONEJUMIN_USER SET
              USER_PHOTO = $1
              WHERE USER_ID = $2
            `
            ,[
              imgPath
              ,req.user.user_id
            ]
          ).then(
            function(){
              req.user.user_photo = imgPath;
              res.render("users/user_photo",{user_info:req.user})
            }
          )
      }
    }
  })
});

module.exports = router;
