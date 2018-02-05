
var express           = require('express');
var db                = require('./db');
var crypto            = require('crypto'); 
var moment            = require('moment'); //시간

module.exports = {
    visitLog : function (req,res,next) {
        let visitKey = ''
        if(req.cookies.visitid == null){
            visitKey = String.fromCharCode(((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65),((Math.random() * 26) + 65))+''+moment(new Date()).format('YYYYMMDDHHmmssSSS')
            visitKey = crypto.createHash('sha512').update(visitKey).digest('base64')
            res.cookie('visitid', visitKey ,{
                maxAge: 180000
            });
            db.query(
                `
                    INSERT INTO VISIT_LOG
                    (
                        VISIT_ID
                        ,CREATE_DATE
                        ,DEVICE
                    )
                    VALUES(
                        $1
                        ,timezone('KST'::text, now())
                        ,$2
                    )
                `
                ,[visitKey
                  ,req.useragent.isDesktop==true?"pc":"mobile"
                ]
            )
        }
    }
};
