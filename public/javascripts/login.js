var rtn_flg = new Array();
$(function(){
    $('#user_password').keyup(function(e){
        var email      = $('#Email');
        var password   = $('#user_password');
        if(e.keyCode == 13){
            rtn_flg[0] = chkLogin(email,'이메일');
            rtn_flg[1] = chkLogin(password,'비밀번호');
            
            for(var i = 0 ; i < rtn_flg.length ; i ++ ){
                if(!rtn_flg[i]){
                    return false;
                }
            }
            var curUrl = window.location.href

            curUrl = curUrl.replace('//','')
                            .replace(window.location.protocol,'')
                            .replace(window.location.host,'')
            $('#url').val(curUrl)
            $('#f_login').submit();
        }
    })

    $('#sb_login').click(function(){
        var email      = $('#Email');
        var password   = $('#user_password');
        rtn_flg[0] = chkLogin(email,'이메일');
        rtn_flg[1] = chkLogin(password,'비밀번호');
        
        for(var i = 0 ; i < rtn_flg.length ; i ++ ){
            if(!rtn_flg[i]){
                return false;
            }
        }

        var curUrl = window.location.href

        curUrl = curUrl.replace('//','')
                       .replace(window.location.protocol,'')
                       .replace(window.location.host,'')
        $('#url').val(curUrl)
        $('#f_login').submit();
    })

    $("#forgot_password").click(function(){
        $("#modal_forget_password").modal("show")
    })

    $("#ret_send").click(function(){
        var email = $("#ret_email")
        var send_flg = isValidJoin(email,'10');
        if(!send_flg){
            return false;
        }

        var json_obj = {
                            k_email : email.val()
                        }
        var parma_obj = JSON.stringify(json_obj);

        $.ajax({
            type:"post",
            data : parma_obj,
            url:'/users/forgot_password',
            dataType : "json",
            contentType: "application/json; charset=utf-8",
            success : function(data) {
                alert(data.msg);
            },
            error : function(e) {
                alert('email 전송 실패')
            }
        });
    })
})

/*로그인 필수 여부 확인 */
function chkLogin(obj,msg){
    if($(obj).val().trim().length == 0){
        $(obj).next().html(msg+'를 입력해주시기 바랍니다.');
        return false;
    }
    return true;
}