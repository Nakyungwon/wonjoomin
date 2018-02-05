/**
 * 필수 체크
 * @param {*} obj 화면 컴포넌트의 객체
 * @param {*} msg 메세지
 */
function isValid(obj,msg){
    var r_valid = true;
    var r_obj   = $(obj).val().trim();

    if(r_obj == null || r_obj == '' || r_obj == 'Undefined'){
        alert(msg + ' 입력은 필수 입니다.');
        $(obj).focus();
        r_valid = false;
    }
    return r_valid;
}

/**
 * 필수 체크
 * @param {*} obj 화면 컴포넌트의 객체
 * @param {*} msg 메세지
 */
function isValidSummerNote(obj,msg){
    var r_valid = true;

    if( $(obj).summernote('isEmpty')){
        alert(msg + ' 입력은 필수 입니다.');
        $(obj).summernote('focus');
        r_valid = false;
    }

    if($(obj).val().length > 300000){
        alert(msg + '300000 이하여야 합니다. 태그가 포함되어있어 실제 입력한 글자수보다 많을 수 있습니다. 현재 : '+$(obj).val().length+'자')
        return false;
    }
    return r_valid;
}

/**
 * 필수 체크
 * @param {*} obj 화면 컴포넌트의 객체
 * @param {*} msg 메세지
 */
function isValid2(p_val){
    var r_valid = true;

    if(p_val == null || p_val == '' || p_val == 'Undefined'){
        r_valid = false;
    }

    return r_valid;
}

/**
 * 필수체크 회원가입 및 로그인
 * @param {*} obj 화면 컴포넌트의 객체
 * @param {*} gbn 구분값(1:Email ,2:닉네임, 3:비밀번호, 4,재확인)
 */
function isValidJoin(obj,gbn){
    var r_valid = true;
    var r_obj   = $(obj).val().trim();
    var reg_email = /^([\w\.-]+)@([a-z\d\.-]+)\.([a-z\.]{2,6})$/;

    if(r_obj == null || r_obj == '' || r_obj == 'Undefined'){
        var nodObj = $(obj).nextAll();
        for(var i = 0 ; i < nodObj.length ; i ++){
            if(nodObj.eq(i).attr("class") == 'text-danger'){
                nodObj.html('필수 입력 항목입니다.')
            }
        }
        r_valid = false;
    }else{
        switch(gbn){
            case '1': //email
                if(!reg_email.test(r_obj)){
                    $(obj).next().html('이메일 형식이 아닙니다.');
                    r_valid = false;
                }else{
                    if(!dubEmail($(obj))){
                        $(obj).next().html('이미 등록되어 있는 메일입니다.');
                        r_valid = false;
                    }else{
                        $(obj).next().html('');
                        r_valid = true;
                    }
                }
            break;
            case '2': // 닉네임
                if(r_obj.length < 2 || r_obj.length > 6){
                    $(obj).next().html('닉네임은 2자리에서 6자리까지 가능합니다.');
                    r_valid = false;
                }else{
                    if(!dubNick($(obj))){
                        $(obj).next().html('이미 등록되어 있는 닉네임 입니다.');
                        r_valid = false;
                    }else{
                        $(obj).next().html('');
                        r_valid = true;
                    }
                }
            break;
            case '3': // 비밀번호
                if(r_obj.length < 8 || r_obj.length > 12){
                    $(obj).next().html('비밀번호는 8자리에서 12자리까지 가능합니다.');
                    r_valid = false;
                }else{
                    $(obj).next().html('');
                    r_valid = true;
                }
            break;
            case '4': // 비밀번호 재확인
                if($('#password').val().trim() != r_obj){
                    $(obj).next().html('입력된 비밀번호와 다릅니다.');
                    r_valid = false;
                }else{
                    $(obj).next().html('');
                    r_valid = true;
                }
            break;
            case '5': // 닉네임
                if(r_obj.length < 2 || r_obj.length > 6){
                    $(obj).parent().next().html('닉네임은 2자리에서 6자리까지 가능합니다.');
                    r_valid = false;
                }else{
                    if(!dubNick($(obj))){
                        $(obj).parent().next().html('이미 등록되어 있는 닉네임 입니다.');
                        r_valid = false;
                    }else{
                        $(obj).parent().next().html('');
                        r_valid = true;
                    }
                }
            break;
            case '10': //retrieve email
                if(!reg_email.test(r_obj)){
                    $(obj).next().html('이메일 형식이 아닙니다.');
                    r_valid = false;
                }else{
                    $(obj).next().html('');
                    r_valid = true;
                }
            break;
            default:
        }
    }
    
    return r_valid;
}


function dubEmail(email){
    var j_email = {
                    k_email : $(email).val().trim()
                  }
    var rtn_flag  = true;
    parma_obj = JSON.stringify(j_email);

    $.ajax({
        type:"post",
        data : parma_obj,
        async : false,
        url:"/users/dub_email",
        dataType : "json",
        contentType: "application/json; charset=utf-8",
        success : function(data) {
            if(Number(data.useYn) > 0){
                rtn_flag = false;
            }else{
                rtn_flag = true;
            }
        },
        error : function(e) {
            alert('E-mail 체크 error');
        }
    });
   return rtn_flag;
}

function dubNick(nickname){
    var j_nickname = {
                    k_nickname : $(nickname).val().trim()
                  }
    var rtn_flag  = true;
    parma_obj = JSON.stringify(j_nickname);

    $.ajax({
        type:"post",
        data : parma_obj,
        async : false,
        url:"/users/dub_nickname",
        dataType : "json",
        contentType: "application/json; charset=utf-8",
        success : function(data) {
            if(Number(data.useYn) > 0){
                rtn_flag = false;
            }else{
                rtn_flag = true;
            }
        },
        error : function(e) {
            alert('E-mail 체크 error');
        }
    });
   return rtn_flag;
}

/* 모바일시 이미지 길이 */
function imgSize(obj){
    var h_size = null
    for(var i = 0 ; i < $(obj).length ; i ++){
        h_size = $(obj).eq(i).width();
        $(obj).eq(i).height(h_size/1.3);
    }
}

function xxsBlock(text){
   var xxs = text.replace(/</gi, "&lt;")
                 .replace(/>/gi, "&gt;")
                 .replace(/'/gi, "&apos;")
                 .replace(/"/gi, "&quot;")
                 .replace(/\n/gi, "<br>")
    return xxs
}

function checkImg(obj, ext){ 
    var check = false; 
    var extName = $(obj).val().substring($(obj).val().lastIndexOf(".")+1).toUpperCase(); 
    var str = ext.split(","); 
    for (var i=0;i<str.length;i++) { 
        if(extName == $.trim(str[i])) { 
            check = true; break; 
        } else check = false; 
    } if(!check) { 
        alert(ext+" 파일만 업로드 가능합니다."); 
    } 
    return check; 
}

function checkSummerNoteImg(p_value,ext){ 
    var check = false; 
    var extName = p_value.substring(p_value.lastIndexOf(".")+1).toUpperCase(); 
    var str = ext.split(","); 
    for (var i=0;i<str.length;i++) { 
        if(extName == $.trim(str[i])) { 
            check = true; break; 
        } else check = false; 
    } if(!check) { 
        alert(ext+" 파일만 업로드 가능합니다."); 
    } 
    return check; 
}

// 첨부파일 용량 확인 
function checkImgSize(obj, size) { 
    var check = false; 
    
    if(window.ActiveXObject) {//IE용인데 IE8이하는 안됨... 
        var fso = new ActiveXObject("Scripting.FileSystemObject"); 
        //var filepath = document.getElementById(obj).value; 
        var filepath = obj[0].value; 
        var thefile = fso.getFile(filepath); 
        sizeinbytes = thefile.size; 
    } else {//IE 외 
        //sizeinbytes = document.getElementById(obj).files[0].size; 
        sizeinbytes = obj[0].files[0].size; 
    } 
    var fSExt = new Array('Bytes', 'KB', 'MB', 'GB'); 
    var i = 0; 
    var checkSize = size; 
    while(checkSize>900) { 
        checkSize/=1024; i++; 
    } 
    checkSize = (Math.round(checkSize*100)/100)+' '+fSExt[i]; 
    
    var fSize = sizeinbytes; 
    if(fSize > size) { 
        alert("첨부파일은 "+ checkSize + " 이하로 등록가능합니다."); 
        check = false; 
    } else { 
        check = true; 
    } 
    return check; 
}