var express   = require('express');
var db        = require('./db');
var path      = require('path');
var crypto    = require('crypto'); //암호화
var moment    = require('moment'); //시간 
var autoLogin = require('./autoLogin');
var ipaddr    = require('ipaddr.js');

var router = express.Router();

/** 자동로그인 */
router.all('/manage', function(req,res,next){
  autoLogin.autoLogin(req,res,next);
  }
)

/**
 * admin 페이지로가기
 */
router.get('/manage', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        const visitList = await db.query(
        `
            SELECT
            (
                SELECT COUNT(*)
                FROM VISIT_LOG
                WHERE CREATE_DATE > TIMEZONE('KST'::TEXT, NOW()) - INTERVAL '30MINUTES'
            ) AS C_VISIT
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()),'YYYYMMDD')
            ) AS T_DAY_TOT
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()),'YYYYMMDD')
                  AND DEVICE = 'pc'
            ) AS T_DAY_PC
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()),'YYYYMMDD')
                  AND DEVICE = 'mobile'
            ) AS T_DAY_MOBILE
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()) - INTERVAL '1 DAY' ,'YYYYMMDD')
            ) AS Y_DAY_TOT
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()) - INTERVAL '1 DAY' ,'YYYYMMDD')
                  AND DEVICE = 'pc'
            ) AS Y_DAY_PC
            ,(
                SELECT COUNT(*) 
                FROM VISIT_LOG
                WHERE TO_CHAR(CREATE_DATE,'YYYYMMDD') = TO_CHAR(TIMEZONE('KST'::TEXT, NOW()) - INTERVAL '1 DAY' ,'YYYYMMDD')
                AND DEVICE = 'mobile'
            ) AS Y_DAY_MOBILE

        `
        )
        res.render('admin/manage',{visitList:visitList.rows[0],user_info   : req.user})
    }
});

/** 자동로그인 */
router.all('/user_grade', function(req,res,next){
    autoLogin.autoLogin(req,res,next);
  }
)

/**
 * admin 유저/IP차단 페이지 이동
 */
router.get('/user_grade', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        res.render('admin/user_grade',{user_info   : req.user})
    }
});

/**
 * admin 유저/IP차단 검색
 */
router.post('/search_user' , async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error')
    }else{
    const { k_searchVal } = req.body;
    const userList = await db.query(
    `
    SELECT A.USER_ID      AS USER_ID
            ,A.NICK_NAME    AS NICK_NAME
            ,A.USER_GRADE   AS USER_GRADE
            ,COALESCE(
                (
                    SELECT BAN_CODE
                        FROM USER_IP_BAN B
                        WHERE B.USER_ID = A.USER_ID
                        AND B.END_DATE > timezone('KST'::text, now())
                        AND B.START_DATE < timezone('KST'::text, now())
                ) 
            ,'N')           AS BAN_CODE
        FROM ONEJUMIN_USER A
        WHERE A.USER_GRADE <> 'BRAHMAN'
        AND   (
                    A.USER_ID LIKE '%'||$1||'%'
                OR  A.NICK_NAME LIKE '%'||$1||'%'
            )
        ORDER BY CREATE_DATE DESC
    `
    ,[k_searchVal]
    )

    var menuStr=''
    menuStr += '['
    for(var i = 0 ; i < userList.rows.length; i++){
        menuStr += '{ "user_id" : "'+ userList.rows[i].user_id+'", "nick_name" : "'+ userList.rows[i].nick_name+'", "user_grade" : "'+ userList.rows[i].user_grade+'", "ban_code" : "'+ userList.rows[i].ban_code+'"}'
        if( i != userList.rows.length - 1){
            menuStr += ',';
        }
    }
    menuStr += ']'

    const ipList = await db.query(
        `
        SELECT B.USER_IP
                ,B.BAN_CODE
            FROM USER_IP_BAN B
        WHERE B.END_DATE > timezone('KST'::text, now())
            AND B.START_DATE < timezone('KST'::text, now())
        `
        )

        var ipStr=''
        ipStr += '['
        for(var i = 0 ; i < ipList.rows.length; i++){
            ipStr += '{ "user_ip"       : "'+ ipList.rows[i].user_ip
                        +'", "ban_code"    : "'+ ipList.rows[i].ban_code
                        +'"}'
            if( i != ipList.rows.length - 1){
                ipStr += ',';
            }
        }
        ipStr += ']'
        res.send({menuStr : menuStr, ipStr : ipStr})
    }
})

/** 자동로그인 */
router.all('/board_manage', function(req,res,next){
    autoLogin.autoLogin(req,res,next);
  }
)

/**
 * admin 글 차단 페이지 이동
 */
router.get('/board_manage', function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        res.render('admin/board_manage',{user_info   : req.user});
    }
});

router.post('/search_board', async function(req, res, next) {
    if(!req.user || req.user.user_grade != 'BRAHMAN'){
        res.render('main/error')
    }else{
        const {k_frdate, k_todate} = req.body;
        const boardList = await db.query(
            `
            SELECT D.SM_MENU_NAME 
                   ,D.SM_MENU_ID
                   ,B.BOARD_TITLE
                   ,A.BOARD_SEQ
                   ,B.CREATE_IP
                   ,B.USER_YN
                   ,B.USE_YN
                   ,B.CREATE_ID
                   ,A.REPORT_CNT
                   ,D.MENU_GBN
                   FROM
                   (
                       SELECT COUNT(*) AS REPORT_CNT,
                               A1.SM_MENU_ID,
                               A1.BOARD_SEQ
                       FROM BOARD_STATUS A1
                       WHERE A1.COMMENT_SEQ IS NULL
                       AND A1.BOARD_GBN = 'R'
                       GROUP BY A1.SM_MENU_ID, A1.BOARD_SEQ 
                   ) A,
                   BOARD B,
                   SM_MENU D
                   WHERE 1 =1
                   AND A.BOARD_SEQ = B.BOARD_SEQ
                   AND A.SM_MENU_ID = B.SM_MENU_ID
                   AND A.SM_MENU_ID = D.SM_MENU_ID
                   AND TO_CHAR(B.CREATE_DATE,'YYYY-MM-DD') <= $1
                   AND TO_CHAR(B.CREATE_DATE,'YYYY-MM-DD') >= $2
                   ORDER BY B.USE_YN DESC,A.REPORT_CNT DESC
            `
            ,[k_todate, k_frdate]
            )
    
            var menuStr=''
            menuStr += '['
            for(var i = 0 ; i < boardList.rows.length; i++){
                menuStr += '{ "sm_menu_name"    : "'+ boardList.rows[i].sm_menu_name
                         +'", "sm_menu_id"      : "'+ boardList.rows[i].sm_menu_id
                         +'", "board_title"     : "'+ boardList.rows[i].board_title.replace(/</gi , "&lt;")
                                                                                    .replace(/>/gi , "&gt;")
                                                                                    .replace(/'/gi , "&apos;")
                                                                                    .replace(/"/gi , "&quot;")
                                                                                    .replace(/\n/gi, "<br>")
                         +'", "board_seq"       : "'+ boardList.rows[i].board_seq
                         +'", "create_ip"       : "'+ boardList.rows[i].create_ip
                         +'", "user_yn"         : "'+ boardList.rows[i].user_yn
                         +'", "use_yn"          : "'+ boardList.rows[i].use_yn
                         +'", "create_id"       : "'+ boardList.rows[i].create_id
                         +'", "report_cnt"      : "'+ boardList.rows[i].report_cnt
                         +'", "menu_gbn"        : "'+ boardList.rows[i].menu_gbn
                         +'"}'
                if( i != boardList.rows.length - 1){
                    menuStr += ',';
                }
            }
            menuStr += ']'
    
            const commentList = await db.query(
                `
                SELECT  D.SM_MENU_ID
                        ,D.SM_MENU_NAME
                        ,A.BOARD_SEQ
                        ,B.COMMENT_SEQ
                        ,B.COMMENT_CONTENT
                        ,A.REPORT_CNT
                        ,B.USE_YN
                        ,B.CREATE_IP
                        ,B.USER_YN
                        ,B.CREATE_ID
                        ,D.MENU_GBN
                FROM
                (
                    SELECT COUNT(*) AS REPORT_CNT,
                             A1.SM_MENU_ID,
                             A1.BOARD_SEQ,
                             A1.COMMENT_SEQ
                      FROM BOARD_STATUS A1
                     WHERE A1.COMMENT_SEQ IS NOT NULL
                       AND A1.BOARD_GBN = 'R'
                     GROUP BY A1.SM_MENU_ID, A1.BOARD_SEQ ,A1.COMMENT_SEQ
                ) A,
                BOARD_COMMENT B,
                SM_MENU D
                WHERE 1 =1
                  AND A.BOARD_SEQ = B.BOARD_SEQ
                  AND A.SM_MENU_ID = B.SM_MENU_ID
                  AND A.COMMENT_SEQ = B.COMMENT_SEQ
                  AND A.SM_MENU_ID = D.SM_MENU_ID
                  AND TO_CHAR(B.CREATE_DATE,'YYYY-MM-DD') <= $1
                  AND TO_CHAR(B.CREATE_DATE,'YYYY-MM-DD') >= $2
                  ORDER BY  B.USE_YN DESC,A.REPORT_CNT DESC
                `
                ,[k_todate, k_frdate]
                )
        
                var commentStr=''
                commentStr += '['
                for(var i = 0 ; i < commentList.rows.length; i++){
                    commentStr += '{ "sm_menu_name"        : "'+ commentList.rows[i].sm_menu_name
                             +'", "sm_menu_id"          : "'+ commentList.rows[i].sm_menu_id
                             +'", "comment_content"     : "'+ commentList.rows[i].comment_content.replace(/</gi , "&lt;")
                                                                                                .replace(/>/gi , "&gt;")
                                                                                                .replace(/'/gi , "&apos;")
                                                                                                .replace(/"/gi , "&quot;")
                                                                                                .replace(/\n/gi, "<br>")
                             +'", "comment_seq"         : "'+ commentList.rows[i].comment_seq
                             +'", "board_seq"           : "'+ commentList.rows[i].board_seq
                             +'", "create_ip"           : "'+ commentList.rows[i].create_ip
                             +'", "user_yn"             : "'+ commentList.rows[i].user_yn
                             +'", "use_yn"              : "'+ commentList.rows[i].use_yn
                             +'", "create_id"           : "'+ commentList.rows[i].create_id
                             +'", "report_cnt"          : "'+ commentList.rows[i].report_cnt
                             +'", "menu_gbn"            : "'+ commentList.rows[i].menu_gbn
                             +'"}'
                    if( i != commentList.rows.length - 1){
                        commentStr += ',';
                    }
                }
                commentStr += ']'
        res.send({menuStr : menuStr, commentStr : commentStr});
    }

})

/**
 * admin 사용자 차단
 */
router.post('/user_modify',  function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error')
    }else{
        const{ban_code,user_id,user_grade} = req.body;
        var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
        db.query(
            `
                UPDATE ONEJUMIN_USER SET
                USER_GRADE = $1
                WHERE USER_ID = $2
            `
        ,[user_grade,user_id]
        ).then(
            function(){
                db.query(
                    `
                        SELECT COUNT(*)  AS CNT
                         FROM USER_IP_BAN
                        WHERE END_DATE > timezone('KST'::text, now())
                          AND START_DATE < timezone('KST'::text, now())
                          AND USER_ID  = $1
                    `
                    ,[user_id]
                ).then(
                    function(ban_yn){
                        var interval = ''
                        switch(ban_code){
                            case 'N'    : interval = "0day"
                            case 'DAY'  : interval = '3day'
                            break;
                            case 'WEEK' : interval = "7day"
                            break;
                            case 'MONTH': interval = "30day"
                            break;
                            case 'DEATH': interval = "100year"
                            break;
                        }
                        if(ban_yn.rows[0].cnt > 0){
                                    var start_date = ` (SELECT START_DATE  AS START_DATE
                                                        FROM USER_IP_BAN
                                                        WHERE END_DATE > timezone('KST'::text, now())
                                                        AND   START_DATE < timezone('KST'::text, now())
                                                        AND   USER_ID  = $1)`
                                    var queryStr =  `
                                                        UPDATE USER_IP_BAN SET
                                                        BAN_CODE = $2
                                                    `
                                    switch(ban_code){
                                        case 'N'  : queryStr +=     ",END_DATE = "+ start_date +"+INTERVAL'0day'"
                                        break;
                                        case 'DAY': queryStr +=     ",END_DATE = "+ start_date +"+INTERVAL'3day'"
                                        break;
                                        case 'WEEK': queryStr +=    ",END_DATE = "+ start_date +"+INTERVAL'7day'"
                                        break;
                                        case 'MONTH': queryStr +=   ",END_DATE = "+ start_date +"+INTERVAL'30day'"
                                        break;
                                        case 'DEATH': queryStr +=   ",END_DATE = "+ start_date +"+INTERVAL'100year'"
                                        break;
                                    }
                                    queryStr +=     `
                                                        WHERE
                                                        END_DATE > timezone('KST'::text, now())
                                                        AND START_DATE < timezone('KST'::text, now())
                                                        AND USER_ID  = $1
                                                    `
                                    db.query(
                                        queryStr
                                        ,[user_id,ban_code]
                                    ).then(
                                        function(){
                                            res.send({rtnFlag:true})
                                        }
                                    )
                        }else{
                        var queryStr =   `
                                INSERT INTO USER_IP_BAN
                                (
                                    USER_ID   
                                    ,BAN_CODE  
                                    ,START_DATE
                                    ,END_DATE  
                                    ,CREATE_ID 
                                    ,CREATE_IP 
                                )VALUES(
                                    $1
                                    ,$2
                                    ,timezone('KST'::text, now())
                                `
                            switch(ban_code){
                                case 'N'  : queryStr +=  ",timezone('KST'::text, now())+INTERVAL'0day'"
                                break;
                                case 'DAY': queryStr += ",timezone('KST'::text, now())+INTERVAL'3day'"
                                break;
                                case 'WEEK': queryStr += ",timezone('KST'::text, now())+INTERVAL'7day'"
                                break;
                                case 'MONTH': queryStr += ",timezone('KST'::text, now())+INTERVAL'30day'"
                                break;
                                case 'DEATH': queryStr += ",timezone('KST'::text, now())+INTERVAL'100year'"
                                break;
                            }
                            queryStr += `        
                                    ,$3
                                    ,$4
                                )
                            `
                            db.query(
                                queryStr
                                ,[user_id,ban_code,req.user.user_id,ip]
                            ).then(
                                function(){
                                    res.send({rtnFlag:true})
                                }
                            )
                        }
                    }
                )
            }
        )          
    }
});


/**
 * admin IP 차단
 */
router.post('/ip_modify',  function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error')
    }else{
        const{ban_code,user_ip} = req.body;
        var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
        db.query(
            `
                SELECT COUNT(*)  AS CNT
                    FROM USER_IP_BAN
                WHERE END_DATE > timezone('KST'::text, now())
                    AND START_DATE < timezone('KST'::text, now())
                    AND USER_IP  = $1
            `
            ,[user_ip]
        ).then(
            function(ban_yn){
                var interval = ''
                switch(ban_code){
                    case 'N'    : interval = "0day"
                    case 'DAY'  : interval = '3day'
                    break;
                    case 'WEEK' : interval = "7day"
                    break;
                    case 'MONTH': interval = "30day"
                    break;
                    case 'DEATH': interval = "100year"
                    break;
                }
                if(ban_yn.rows[0].cnt > 0){
                            var start_date = ` (SELECT START_DATE  AS START_DATE
                                                FROM USER_IP_BAN
                                                WHERE END_DATE > timezone('KST'::text, now())
                                                AND   START_DATE < timezone('KST'::text, now())
                                                AND   USER_IP  = $1)`
                            var queryStr =  `
                                                UPDATE USER_IP_BAN SET
                                                BAN_CODE = $2
                                            `
                            switch(ban_code){
                                case 'N'  : queryStr +=     ",END_DATE = "+ start_date +"+INTERVAL'0day'"
                                break;
                                case 'DAY': queryStr +=     ",END_DATE = "+ start_date +"+INTERVAL'3day'"
                                break;
                                case 'WEEK': queryStr +=    ",END_DATE = "+ start_date +"+INTERVAL'7day'"
                                break;
                                case 'MONTH': queryStr +=   ",END_DATE = "+ start_date +"+INTERVAL'30day'"
                                break;
                                case 'DEATH': queryStr +=   ",END_DATE = "+ start_date +"+INTERVAL'100year'"
                                break;
                            }
                            queryStr +=     `
                                                WHERE
                                                END_DATE > timezone('KST'::text, now())
                                                AND START_DATE < timezone('KST'::text, now())
                                                AND USER_IP  = $1
                                            `
                            db.query(
                                queryStr
                                ,[user_ip,ban_code]
                            ).then(
                                function(){
                                    res.send({rtnFlag:true})
                                }
                            )
                }else{
                var queryStr =   `
                        INSERT INTO USER_IP_BAN
                        (
                            USER_IP   
                            ,BAN_CODE  
                            ,START_DATE
                            ,END_DATE  
                            ,CREATE_ID 
                            ,CREATE_IP 
                        )VALUES(
                            $1
                            ,$2
                            ,timezone('KST'::text, now())
                        `
                    switch(ban_code){
                        case 'N'  : queryStr +=  ",timezone('KST'::text, now())+INTERVAL'0day'"
                        break;
                        case 'DAY': queryStr += ",timezone('KST'::text, now())+INTERVAL'3day'"
                        break;
                        case 'WEEK': queryStr += ",timezone('KST'::text, now())+INTERVAL'7day'"
                        break;
                        case 'MONTH': queryStr += ",timezone('KST'::text, now())+INTERVAL'30day'"
                        break;
                        case 'DEATH': queryStr += ",timezone('KST'::text, now())+INTERVAL'100year'"
                        break;
                    }
                    queryStr += `        
                            ,$3
                            ,$4
                        )
                    `
                    db.query(
                        queryStr
                        ,[user_ip,ban_code,req.user.user_id,ip]
                    ).then(
                        function(){
                            res.send({rtnFlag:true})
                        }
                    )
                }
            }
        )
    }
});

/** 자동로그인 */
router.all('/menu_manage', function(req,res,next){
    autoLogin.autoLogin(req,res,next);
  }
)

/**
 * admin 메뉴관리페이지
 */
router.get('/menu_manage', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        const menuList = await db.query(
            `
                SELECT MENU_ID      AS MENU_ID
                     ,MENU_NAME     AS MENU_NAME
                     ,USE_YN        AS USE_YN
                     ,ORDER_PORITY  AS ORDER_PORITY
                  FROM MENU_MASTER
                  ORDER BY ORDER_PORITY ASC
            `
        ) 
        var menuStr=''
        menuStr += '['
        for(var i = 0 ; i < menuList.rows.length; i++){
            menuStr += '{ "menu_id" : "'+ menuList.rows[i].menu_id+'", "menu_name" : "'+ menuList.rows[i].menu_name+'", "use_yn" : "'+menuList.rows[i].use_yn+'", "order_pority" : "'+menuList.rows[i].order_pority+'"}'
            if( i != menuList.rows.length - 1){
                menuStr += ',';
            }
        }
        menuStr += ']'
        res.render('admin/menu_manage',{menuStr: menuStr,user_info   : req.user})
    }
});

/**
 * admin 메뉴마스터 생성
 */
router.post('/menu_insert', function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
      var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
      const{ menu_id, menu_name , use_yn, order_pority } = req.body
      db.query(
        `
            INSERT INTO MENU_MASTER(
                MENU_ID     
                ,MENU_NAME   
                ,USE_YN      
                ,ORDER_PORITY
                ,CREATE_ID   
                ,CREATE_DATE 
                ,CREATE_IP   
                ,UPDATE_ID   
                ,UPDATE_DATE 
                ,UPDATE_IP   
            )VALUES(
                $1
                ,$2
                ,$3
                ,$4
                ,$5
                ,timezone('KST'::text, now())
                ,$6
                ,$5
                ,timezone('KST'::text, now())
                ,$6
            )
        `
        ,[menu_id,menu_name,use_yn,order_pority,req.user.user_id,ip]
      )
      res.send({msg:'생성 되었습니다.'})
    }
});

/**
 * admin 메뉴수정
 */
router.post('/menu_modify', function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
      var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
      const{ menu_id, menu_name , use_yn, order_pority } = req.body
      db.query(
        `
            UPDATE MENU_MASTER SET
                MENU_NAME       = $1
                ,USE_YN         = $2
                ,ORDER_PORITY   = $3
                ,UPDATE_DATE    = timezone('KST'::text, now())
                ,UPDATE_ID      = $4
                ,UPDATE_IP      = $5
          WHERE MENU_ID         = $6
        `
        ,[menu_name ,use_yn, order_pority ,req.user.user_id ,ip ,menu_id]
      )
      res.send({msg:'저장 되었습니다.'})
    }
});

/**
 * admin 소메뉴메뉴관리페이지
 */
router.post('/sm_menu_list', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        console.log(req.body)
        const{menu_id}  = req.body
        const smMenuList = await db.query(
            `
                SELECT  SM_MENU_ID       AS  SM_MENU_ID
                       ,MENU_ID          AS  MENU_ID
                       ,SM_MENU_NAME     AS  SM_MENU_NAME
                       ,SM_MENU_ABB      AS  SM_MENU_ABB
                       ,SM_MENU_SUBCRIPT AS  SM_MENU_SUBCRIPT
                       ,INDEX_YN         AS  INDEX_YN
                       ,WRITE_YN         AS  WRITE_YN
                       ,STAR_YN          AS  STAR_YN
                       ,USE_YN           AS  USE_YN 
                       ,ORDER_PORITY     AS  ORDER_PORITY
                       ,MENU_GBN         AS  MENU_GBN
                  FROM SM_MENU
                 WHERE MENU_ID = $1
                 ORDER BY ORDER_PORITY ASC
            `
            ,[menu_id]
        ) 

        var menuStr=''
        menuStr += '['
        for(var i = 0 ; i < smMenuList.rows.length; i++){
            menuStr += '{ "sm_menu_id" : "'+ smMenuList.rows[i].sm_menu_id
                    +'", "sm_menu_name" : "'+ smMenuList.rows[i].sm_menu_name
                    +'", "sm_menu_abb" : "'+ smMenuList.rows[i].sm_menu_abb
                    +'", "sm_menu_subcript" : "'+ smMenuList.rows[i].sm_menu_subcript
                    +'", "menu_gbn" : "'+ smMenuList.rows[i].menu_gbn
                    +'", "index_yn" : "'+ smMenuList.rows[i].index_yn
                    +'", "write_yn" : "'+ smMenuList.rows[i].write_yn
                    +'", "star_yn" : "'+ smMenuList.rows[i].star_yn
                    +'", "use_yn" : "'+smMenuList.rows[i].use_yn
                    +'", "order_pority" : "'+smMenuList.rows[i].order_pority
                    +'", "menu_id" : "'+smMenuList.rows[i].menu_id
                    +'"}'
            if( i != smMenuList.rows.length - 1){
                menuStr += ',';
            }
        }
        menuStr += ']'
        res.send({menuStr: menuStr})
    }
});

/**
 * admin 소메뉴생성
 */
router.post('/sm_menu_insert', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
      var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
      const{ sm_menu_id, sm_menu_name, sm_menu_abb,sm_menu_subcript , use_yn, order_pority,menu_gbn,menu_id,index_yn, write_yn, star_yn } = req.body
      await db.query(
        `
            INSERT INTO SM_MENU(
                SM_MENU_ID
                ,MENU_ID
                ,SM_MENU_NAME  
                ,SM_MENU_ABB      
                ,SM_MENU_SUBCRIPT 
                ,MENU_GBN
                ,INDEX_YN
                ,WRITE_YN
                ,STAR_YN		  
                ,ORDER_PORITY	  
                ,USE_YN           
                ,CREATE_ID        
                ,CREATE_DATE      
                ,CREATE_IP       
                ,UPDATE_ID        
                ,UPDATE_DATE     
                ,UPDATE_IP        
            )VALUES(
                $1
                ,$2
                ,$3
                ,$4
                ,$5
                ,$6
                ,$7
                ,$8
                ,$13
                ,$9
                ,$10
                ,$11
                ,timezone('KST'::text, now())
                ,$12
                ,$11
                ,timezone('KST'::text, now())
                ,$12
            )
        `
        ,[
          sm_menu_id,
          menu_id,
          sm_menu_name,
          sm_menu_abb,
          sm_menu_subcript,
          menu_gbn,
          index_yn,
          write_yn,
          order_pority,
          use_yn,
          req.user.user_id,
          ip,
          star_yn
        ]
      )
      res.send({msg:'저장 되었습니다.'})
    }
});

/**
 * admin 소메뉴수정
 */
router.post('/sm_menu_modify', async function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
      var ip = ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
      const{ sm_menu_id, sm_menu_name, sm_menu_abb, sm_menu_subcript , use_yn, order_pority, menu_gbn, index_yn, write_yn,star_yn } = req.body
      await db.query(
        `
            UPDATE  SM_MENU SET
                    SM_MENU_NAME     =$1
                    ,SM_MENU_ABB      =$2
                    ,SM_MENU_SUBCRIPT =$3
                    ,MENU_GBN		  =$4
                    ,INDEX_YN         =$10
                    ,WRITE_YN         =$11
                    ,STAR_YN          =$12
                    ,ORDER_PORITY	  =$5
                    ,USE_YN           =$6
                    ,UPDATE_ID        =$7
                    ,UPDATE_DATE      =timezone('KST'::text, now())
                    ,UPDATE_IP        =$8
          WHERE SM_MENU_ID            =$9
        `
        ,[
          sm_menu_name,
          sm_menu_abb,
          sm_menu_subcript,
          menu_gbn,
          order_pority,
          use_yn,
          req.user.user_id,
          ip,
          sm_menu_id,
          index_yn,
          write_yn,
          star_yn
        ]
      )
      res.send({msg:'저장 되었습니다.'})
    }
});

/**
 * 게시판에서 유저 및 ip 차단
 */
router.post('/board_user_block', async function(req, res, next) {
    var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
    const{k_each_seq,k_each_mainYn,k_each_userYn,k_menuId,k_boardSeq} = req.body
    let boardUser = ''
    if(k_each_mainYn === 'Y'){
    boardUser = await db.query(
        `
            SELECT USER_ID      AS USER_ID
                  ,CREATE_IP    AS USER_IP
              FROM BOARD A
             WHERE BOARD_SEQ    = $1
               AND SM_MENU_ID   = $2
        `
        ,[k_each_seq,k_menuId]
      )
    }else{
    boardUser = await db.query(
        `
          SELECT USER_ID        AS USER_ID
                 ,CREATE_IP     AS USER_IP
            FROM BOARD_COMMENT A
           WHERE BOARD_SEQ      = $1
             AND SM_MENU_ID     = $2
             AND COMMENT_SEQ    = $3
        `
        ,[k_boardSeq,k_menuId,k_each_seq]
      )
    }

    if(k_each_userYn === 'Y'){
        const existList =await db.query(
            `
                SELECT COUNT(*) CNT
                  FROM USER_IP_BAN A
                 WHERE USER_ID = $1
                   AND END_DATE > timezone('KST'::text, now())
                   AND START_DATE < timezone('KST'::text, now())
            `
            ,[boardUser.rows[0].user_id]
        )
        if(existList.rows[0].cnt === '0' ){
            await db.query(
                `
                INSERT INTO USER_IP_BAN
                (
                    USER_ID   
                    ,BAN_CODE  
                    ,START_DATE
                    ,END_DATE  
                    ,CREATE_ID 
                    ,CREATE_IP 
                )VALUES(
                    $1
                    ,$2
                    ,timezone('KST'::text, now())
                    ,timezone('KST'::text, now())+INTERVAL'3day'        
                    ,$3
                    ,$4
                )
                `
                ,[boardUser.rows[0].user_id,'DAY',req.user.user_id,ip]
            )
            res.send({msg:'차단 완료 되었습니다.'});
        }else{
            res.send({msg:'이미 차단 되었습니다.'});
        }
    }else{
        const existList =await db.query(
            `
                SELECT COUNT(*) CNT
                  FROM USER_IP_BAN A
                 WHERE USER_IP      = $1
                   AND END_DATE     > timezone('KST'::text, now())
                   AND START_DATE   < timezone('KST'::text, now())
                
            `
            ,[boardUser.rows[0].user_ip]
        )
        if(existList.rows[0].cnt === '0' ){
            await db.query(
                `
                INSERT INTO USER_IP_BAN
                (
                    USER_IP 
                    ,BAN_CODE  
                    ,START_DATE
                    ,END_DATE  
                    ,CREATE_ID 
                    ,CREATE_IP 
                )VALUES(
                    $1
                    ,$2
                    ,timezone('KST'::text, now())
                    ,timezone('KST'::text, now())+INTERVAL'3day'
                    ,$3
                    ,$4
                )
                `
                ,[boardUser.rows[0].user_ip,'DAY',req.user.user_id,ip]
            )
            res.send({msg:'차단 완료 되었습니다.'});
        }else{
            res.send({msg:'이미 차단 되었습니다.'});
        }
    }
});

/**
 * admin 페이지로가기
 */
router.post('/comment_modify', function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
        const{sm_menu_id,board_seq,comment_seq,use_yn,create_id} = req.body
        db.query(
            `
                UPDATE BOARD_COMMENT SET
                    USE_YN          = $1
                    ,UPDATE_IP      = $2 
                    ,UPDATE_ID      = $3
                    ,UPDATE_DATE    = timezone('KST'::text, now())
                WHERE SM_MENU_ID    = $4
                  AND BOARD_SEQ     = $5
                  AND COMMENT_SEQ   = $6
            `
            ,[
                use_yn
                ,ip
                ,req.user.user_id
                ,sm_menu_id
                ,board_seq
                ,comment_seq
            ]
        )
        res.send({rtnFlag:true})
    }
});

/**
 * admin 페이지로가기
 */
router.post('/board_modify', function(req, res, next) {
    if(!req.user || req.user.user_grade !='BRAHMAN'){
        res.render('main/error',{user_info   : req.user})
    }else{
        var ip =  ipaddr.process(req.header('x-forwarded-for')||req.connection.remoteAddress).toString();
        const{sm_menu_id,board_seq,use_yn,create_id} = req.body
        db.query(
            `
                UPDATE BOARD         SET
                    USE_YN          = $1
                    ,UPDATE_IP      = $2 
                    ,UPDATE_ID      = $3
                    ,UPDATE_DATE    = timezone('KST'::text, now())
                WHERE SM_MENU_ID    = $4
                  AND BOARD_SEQ     = $5
            `
            ,[
                use_yn
                ,ip
                ,req.user.user_id
                ,sm_menu_id
                ,board_seq
            ]
        )
        res.send({rtnFlag:true})
    }
});



module.exports = router;
