package com.atguigu.gulimall.thirdparty.controller;

import com.atguigu.common.utils.R;
import com.atguigu.gulimall.thirdparty.component.LocalImageStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController
public class LocalImageController {
    @Autowired private LocalImageStore images;
    @PostMapping("/local/images")
    public R upload(@RequestParam("file") MultipartFile file) throws IOException {
        return R.ok().put("url", "/api/media/" + images.save(file));
    }
    @GetMapping("/media/{name:.+}")
    public ResponseEntity<FileSystemResource> image(@PathVariable String name) throws IOException {
        FileSystemResource resource = new FileSystemResource(images.find(name).toFile());
        return ResponseEntity.ok().contentType(name.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG)
                .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .body(resource);
    }
}
