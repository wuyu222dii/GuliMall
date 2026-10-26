package com.atguigu.gulimall.thirdparty.component;

import com.atguigu.common.security.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.*;

@Component
public class LocalImageStore implements ImageStorage {
    private final Path root;
    @Value("${IMAGE_STORAGE:local}") private String mode="local";
    public LocalImageStore(@Value("${UPLOAD_DIR:.data/uploads}") String directory) throws IOException {
        root=Files.createDirectories(Paths.get(directory).toAbsolutePath().normalize()).toRealPath();
    }
    @PostConstruct public void validateMode() {
        if(!"local".equals(mode))throw new IllegalStateException("OSS image storage is not implemented; use IMAGE_STORAGE=local");
    }
    @Override public String save(Path normalizedImage,String generatedName) throws IOException {
        if(!generatedName.matches("[a-f0-9]{32}\\.(png|jpg)"))throw new ApiProblem(400,"Invalid image storage name");
        Files.move(normalizedImage,root.resolve(generatedName),StandardCopyOption.ATOMIC_MOVE);
        return "/api/media/"+generatedName;
    }
    public Path find(String name) throws IOException {
        if (name == null || !name.matches("[a-f0-9]{32}\\.(png|jpg)")) { throw new ApiProblem(404, "图片不存在"); }
        Path path = root.resolve(name).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                || !path.toRealPath().getParent().equals(root)) { throw new ApiProblem(404, "图片不存在"); }
        return path;
    }
}
