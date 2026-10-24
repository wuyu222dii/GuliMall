package com.atguigu.common.security;

import com.atguigu.common.utils.R;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiErrorAdvice {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<R> tooLarge(Exception e) {
        return ResponseEntity.status(413).contentType(MediaType.APPLICATION_JSON).body(R.error(413, "图片不能超过 2 MB"));
    }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<R> method(Exception e) {
        return ResponseEntity.status(405).contentType(MediaType.APPLICATION_JSON).body(R.error(405, "请求方法不支持"));
    }
    @ExceptionHandler(ApiProblem.class)
    public ResponseEntity<R> problem(ApiProblem e) {
        return ResponseEntity.status(e.getStatus()).contentType(MediaType.APPLICATION_JSON).body(R.error(e.getStatus(), e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, IllegalArgumentException.class,
            MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<R> invalid(Exception e) {
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON).body(R.error(400, "请求参数不正确"));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<R> conflict(Exception e) {
        return ResponseEntity.status(409).contentType(MediaType.APPLICATION_JSON).body(R.error(409, "数据冲突，请检查后重试"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<R> unavailable(Exception e) {
        return ResponseEntity.status(500).contentType(MediaType.APPLICATION_JSON).body(R.error(500, "服务暂时不可用，请稍后重试"));
    }
}
