var express   = require('express');
var db        = require('./db');
var path      = require('path');
var crypto    = require('crypto'); //암호화
var moment    = require('moment'); //시간 
var save      = require('summernote-nodejs'); //서머노트
var multer    = require('multer');
var ipaddr    = require('ipaddr.js');
var autoLogin = require('./autoLogin');
var visitCount = require('./visitCount');
var upload = multer({ 
    limits : { fileSize: 5 * 1024 * 1024 },
    storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, new Date().valueOf() + path.extname(file.originalname));
    }
  }),
});
moment.locale('ko');
var router    = express.Router();

/**
 * 게시판리스트 공통(리스트 화면 , 상세 밑에)
 */
const messageList = async function(req, res, next){
    var page = 1;
    var pg = req.param("pg");    			    	
    if(pg != null && !pg == ""){
      page = Number(pg);
    }
    var field = req.param("search") == null ?'':req.param("search");
    var srow = 0+ (page-1)*15;
    var str =''
    if(req.param('list') == 'R')
      str = 'TO_USER_ID'
    else{
      str = 'FR_USER_ID'
    }
    const messageList = await db.query(
      `
        SELECT  A.FR_USER_ID        AS FR_USER_ID
                ,A.TO_USER_ID       AS TO_USER_ID
                ,A.MESSAGE_TITLE    AS MESSAGE_TITLE
                ,A.MESSAGE_CONTENT  AS MESSAGE_CONTENT
                ,A.READ_YN          AS READ_YN
                ,A.CREATE_DATE      AS CREATE_DATE
                ,A.MESSAGE_SEQ      AS MESSAGE_SEQ
                ,(
                    SELECT B.NICK_NAME 
                      FROM ONEJUMIN_USER B
                     WHERE B.USER_ID = A.FR_USER_ID
                 )                  AS FR_NICK_NAME
                 ,(
                  SELECT B.NICK_NAME 
                    FROM ONEJUMIN_USER B
                   WHERE B.USER_ID = A.TO_USER_ID
                )                   AS TO_NICK_NAME
          FROM MESSAGE A
         WHERE A.`+str+` = $1
         AND (
                   MESSAGE_TITLE   LIKE '%'||$3||'%'
                OR MESSAGE_CONTENT LIKE '%'||$3||'%'
            )
         ORDER BY A.CREATE_DATE DESC
         LIMIT 15 OFFSET $2
      `
      ,[req.user.user_id,srow,field]
    )
  
    const pageList = await db.query(
      `SELECT COUNT(*) CNT
         FROM MESSAGE
        WHERE `+str+` = $1
          AND (
                    MESSAGE_TITLE   LIKE '%'||$2||'%'
                OR  MESSAGE_CONTENT LIKE '%'||$2||'%'
              )
      `
      ,[req.user.user_id,field]
    )
  
    var cnt   = pageList.rows[0].cnt;
    var start = page - (page-1)%5;  
    var end   = Math.floor(cnt/15) + (cnt%15 == 0?0:1);
  
    for(var i = 0 ; i < messageList.rows.length ; i ++){
      if(moment(new Date()).format('YYYYMMDD') === moment(messageList.rows[i].create_date).format('YYYYMMDD')){
        messageList.rows[i].create_date = moment(messageList.rows[i].create_date).fromNow();
      }else{
        messageList.rows[i].create_date = moment(messageList.rows[i].create_date).format('YYYY-MM-DD');
      }
    }
  
    var rtnJson = {
                    messageList  : messageList.rows
                    ,cnt         : cnt
                    ,pg          : page
                    ,search      : field
                    ,start       : start
                    ,end         : end
                }
  
    return rtnJson;
  }

/** 자동로그인 */
router.all('/message_list', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * 메세지 리스트
 */
router.get('/message_list', function(req, res, next) {
    if(!req.user){
      res.render('main/error',{user_info   : req.user})
    }else{
      messageList(req, res, next).then(
          function(rtnList){
            res.render('./message/message_list',{messageList   : rtnList.messageList
                                                ,cnt         : rtnList.cnt
                                                ,pg          : rtnList.pg
                                                ,search      : rtnList.field
                                                ,start       : rtnList.start
                                                ,end         : rtnList.end
                                                ,list        : req.param('list')
                                                ,user_info   : req.user
                                              }
            );
          }
        );
    }
  });

/** 자동로그인 */
router.all('/message_edit', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * 쪽지 생성 페이지 이동 (일반)
 */
router.get('/message_edit', function(req, res, next) {
  const{nick_name} = req.query;
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    res.render('./message/message_edit', {user_info : req.user,nick_name:nick_name});
  }
});

/**
 * 쪽지 생성 페이지 이동 (일반)
 */
router.post('/board_send_message', async function(req, res, next) {
  const{k_each_seq,k_each_mainYn,k_each_userYn,k_menuId,k_boardSeq} = req.body
  let nick_name = '' 
  if(!req.user){
    res.send({rtnFlg:false,msg:'작업오류 입니다.'})
  }else{
    if(k_each_mainYn === 'Y'){
      nick_name = await db.query(
        `
          SELECT B.NICK_NAME
            FROM ONEJUMIN_USER B
          WHERE B.USER_ID = (
                              SELECT A.USER_ID
                                FROM BOARD A
                              WHERE A.BOARD_SEQ  = $1
                                AND A.SM_MENU_ID = $2
                            )
        `
        ,[k_each_seq,k_menuId]
      )
    }else{
    nick_name  = await db.query(
        `
          SELECT B.NICK_NAME
            FROM ONEJUMIN_USER B
          WHERE B.USER_ID = (
                              SELECT A.USER_ID
                                FROM BOARD_COMMENT A
                              WHERE A.BOARD_SEQ   = $1
                                AND A.SM_MENU_ID  = $2
                                AND A.COMMENT_SEQ = $3
                            )
        `
        ,[k_boardSeq,k_menuId,k_each_seq]
      )
    }
    if(nick_name.rows.length === '0'){
      res.send({rtnFlg:false,msg:'해당 유저가 존재 하지 않습니다.'})
    }else{
      res.send({rtnFlg:true,nick_name : nick_name.rows[0].nick_name})
    }
  }
});

/** 자동로그인 */
router.all('/message_ad_edit', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * 쪽지 생성 페이지 이동 (관리자)
 */
router.get('/message_ad_edit', function(req, res, next) {
  if(!req.user || req.user.user_grade != 'BRAHMAN'){
    res.render('main/error',{user_info   : req.user})
  }else{
    res.render('./message/message_ad_edit', {user_info : req.user});
  }
});

/**
 * 관리자 쪽지 생성 
 */
router.post('/message_ad_edit', async function(req, res, next) {
  if(!req.user || req.user.user_grade != 'BRAHMAN'){
    res.render('main/error',{user_info   : req.user})
  }else{
    var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    await db.query(
      `
        INSERT INTO MESSAGE (
          MESSAGE_SEQ 
          ,FR_USER_ID     
          ,TO_USER_ID     
          ,MESSAGE_TITLE  
          ,MESSAGE_CONTENT
          ,READ_YN        
          ,CREATE_DATE    
          ,CREATE_IP      
             
        ) VALUES(
          (SELECT COALESCE(MAX(MESSAGE_SEQ),0) + 1 FROM  MESSAGE)
          ,$1
          ,$2
          ,$3
          ,$4
          ,'N'
          ,timezone('KST'::text, now())
          ,$5
        )
      `
      ,[req.user.user_id,req.param('nick_name'),req.param('message_title'),req.param('message_content'),ip]
    )
    res.redirect('/message/message_list?list=T')
  }
});

/**
 * 일반 쪽지 생성
 */
router.post('/message_edit', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    await db.query(
      `
        INSERT INTO MESSAGE (
          MESSAGE_SEQ 
          ,FR_USER_ID     
          ,TO_USER_ID     
          ,MESSAGE_TITLE  
          ,MESSAGE_CONTENT
          ,READ_YN        
          ,CREATE_DATE    
          ,CREATE_IP      
             
        ) VALUES(
          (SELECT COALESCE(MAX(MESSAGE_SEQ),0) + 1 FROM  MESSAGE)
          ,$1
          ,(SELECT USER_ID FROM ONEJUMIN_USER A WHERE NICK_NAME = $2)
          ,$3
          ,$4
          ,'N'
          ,timezone('KST'::text, now())
          ,$5
        )
      `
      ,[req.user.user_id,req.param('nick_name'),req.param('message_title'),req.param('message_content'),ip]
    )
    res.redirect('/message/message_list?list=T')
  }
});

/**
 * 쪽지 대상찾기
 */
router.post('/ad_search', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    const { k_idNick } = req.body
    const searchList = await db.query(
    `
      SELECT A.USER_ID      AS USER_ID
             ,A.NICK_NAME   AS NICK_NAME
        FROM ONEJUMIN_USER A
       WHERE A.USER_ID   LIKE '%'||$1||'%'
          OR A.NICK_NAME LIKE '%'||$1||'%'
    `
    ,[k_idNick]
    )
    res.send({searchList : searchList.rows});
  }
});

/**
 * 쪽지 대상찾기
 */
router.post('/search', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    const { k_idNick } = req.body
    const searchList = await db.query(
    `
      SELECT A.NICK_NAME   AS NICK_NAME
        FROM ONEJUMIN_USER A
       WHERE A.NICK_NAME LIKE '%'||$1||'%'
    `
    ,[k_idNick]
    )
    res.send({searchList : searchList.rows});
  }
});

/** 자동로그인 */
router.all('/message_view', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * 메세지 상세보기 이동
 */
router.get('/message_view', async function(req, res, next) {
  await db.query(
    `
      UPDATE MESSAGE SET
      READ_YN = 'Y'
      WHERE MESSAGE_SEQ = $1
        AND TO_USER_ID  = $2
    `
    ,
    [req.param('message_seq'),req.user.user_id]
  )

  const messageOne =await db.query(
    `
      SELECT A.FR_USER_ID      AS FR_USER_ID
            ,A.TO_USER_ID      AS TO_USER_ID
            ,A.MESSAGE_TITLE   AS MESSAGE_TITLE 
            ,A.MESSAGE_CONTENT AS MESSAGE_CONTENT
            ,A.CREATE_DATE     AS CREATE_DATE
            ,A.MESSAGE_SEQ     AS MESSAGE_SEQ
            ,(SELECT B.NICK_NAME
                FROM ONEJUMIN_USER B
              WHERE B.USER_ID = A.FR_USER_ID
            )                  AS FR_NICK_NAME 
            ,(SELECT B.NICK_NAME
              FROM ONEJUMIN_USER B
            WHERE B.USER_ID = A.TO_USER_ID
            )                  AS TO_NICK_NAME   
        FROM MESSAGE A
       WHERE MESSAGE_SEQ = $1
    `
    ,
    [req.param('message_seq')]
  )
  res.render('./message/message_view',{messageOne:messageOne.rows,user_info   : req.user})
})

/** 자동로그인 */
router.all('/message_reply', function(req,res,next){
  visitCount.visitLog(req,res,next);
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * 쪽지 답장 페이지 이동
 */
router.get('/message_reply', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    const messageOne = await db.query(
      `
        SELECT B.NICK_NAME  AS NICK_NAME
              ,B.USER_ID    AS USER_ID
          FROM MESSAGE A, ONEJUMIN_USER B
         WHERE A.MESSAGE_SEQ  = $1
           AND A.FR_USER_ID   = B.USER_ID
      `,
      [req.param("message_seq")]
    )
    res.render('./message/message_reply', {messageOne : messageOne.rows,user_info   : req.user});
  }
});

/**
 * 답장(쪽지) 생성
 */
router.post('/message_reply', async function(req, res, next) {
  if(!req.user){
    res.render('main/error',{user_info   : req.user})
  }else{
    var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    await db.query(
      `
        INSERT INTO MESSAGE (
          MESSAGE_SEQ 
          ,FR_USER_ID     
          ,TO_USER_ID     
          ,MESSAGE_TITLE  
          ,MESSAGE_CONTENT
          ,READ_YN        
          ,CREATE_DATE    
          ,CREATE_IP      
             
        ) VALUES(
          (SELECT COALESCE(MAX(MESSAGE_SEQ),0) + 1 FROM  MESSAGE)
          ,$1
          ,$2
          ,$3
          ,$4
          ,'N'
          ,timezone('KST'::text, now())
          ,$5
        )
      `
      ,[req.user.user_id,req.param('user_id'),req.param('message_title'),req.param('message_content'),ip]
    )
    res.redirect('/message/message_list?list=T')
  }
});


module.exports = router;
