package com.atguigu.gulimall.thirdparty.component;

import com.atguigu.common.security.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Iterator;
import java.util.UUID;

@Component
public class ImageUploadService {
    private final ImageStorage storage;
    private final Path root;
    public ImageUploadService(@Value("${UPLOAD_DIR:.data/uploads}") String directory,ImageStorage storage) throws IOException {
        this.storage=storage;
        root = Files.createDirectories(Paths.get(directory).toAbsolutePath().normalize()).toRealPath();
    }
    public String save(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) { throw new ApiProblem(400, "请选择图片"); }
        if (file.getSize() > 2 * 1024 * 1024) { throw new ApiProblem(413, "图片不能超过 2 MB"); }
        String expected = "image/png".equals(file.getContentType()) ? "png" : "image/jpeg".equals(file.getContentType()) ? "jpg" : null;
        if (expected == null) { throw new ApiProblem(400, "只允许 PNG 或 JPEG 图片"); }
        BufferedImage image;
        try (InputStream source = file.getInputStream(); MemoryCacheImageInputStream input = new MemoryCacheImageInputStream(source)) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) { throw new ApiProblem(400, "图片内容无效"); }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input);
                String format = reader.getFormatName();
                if (!("png".equalsIgnoreCase(format) && "png".equals(expected))
                        && !("jpeg".equalsIgnoreCase(format) && "jpg".equals(expected))) { throw new ApiProblem(400, "图片类型与内容不一致"); }
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 8000000) {
                    throw new ApiProblem(400, "图片尺寸不能超过 4096 像素或 800 万像素");
                }
                image = reader.read(0);
            } catch (IOException invalid) { throw new ApiProblem(400, "图片内容无效"); }
            finally { reader.dispose(); }
        }
        String name = UUID.randomUUID().toString().replace("-", "") + "." + expected;
        Path temporary = Files.createTempFile(root, "upload-", ".tmp");
        try {
            // Re-encoding discards the original name, metadata and appended payloads.
            if (!ImageIO.write(image, expected, temporary.toFile())) { throw new IOException("Image encoder unavailable"); }
            String url=storage.save(temporary,name);
            if(url==null || url.trim().isEmpty())throw new IOException("Image storage returned no URL");
            return url;
        } finally { image.flush(); Files.deleteIfExists(temporary); }
    }
}
