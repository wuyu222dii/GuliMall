package com.atguigu.gulimall.thirdparty;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.thirdparty.component.LocalImageStore;
import com.atguigu.gulimall.thirdparty.component.ImageUploadService;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.springframework.mock.web.MockMultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import static org.junit.Assert.*;

public class LocalImageStoreTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    @Test public void imagesAreValidatedRenamedAndPersistAcrossStoreInstances() throws Exception {
        LocalImageStore store = new LocalImageStore(folder.getRoot().toString());
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", bytes);
        String url = new ImageUploadService(folder.getRoot().toString(),store).save(new MockMultipartFile("file", "../../untrusted.svg", "image/png", bytes.toByteArray()));
        String name=url.substring("/api/media/".length());
        assertTrue(name.matches("[a-f0-9]{32}\\.png"));
        assertTrue(Files.isRegularFile(new LocalImageStore(folder.getRoot().toString()).find(name)));
        for (String invalid : new String[]{"../outside.png", "%2e%2e.png", "arbitrary.png"}) {
            try { store.find(invalid); fail("Expected traversal/name rejection"); } catch (ApiProblem problem) { assertEquals(404, problem.getStatus()); }
        }
    }
    @Test public void invalidTypeContentSizeAndDimensionsAreRejected() throws Exception {
        LocalImageStore store = new LocalImageStore(folder.getRoot().toString());
        for (MockMultipartFile file : new MockMultipartFile[]{
                new MockMultipartFile("file", "p.svg", "image/svg+xml", "<svg/>".getBytes("UTF-8")),
                new MockMultipartFile("file", "p.png", "image/png", "not an image".getBytes("UTF-8")),
                new MockMultipartFile("file", "p.png", "image/png", new byte[2 * 1024 * 1024 + 1])}) {
            try { new ImageUploadService(folder.getRoot().toString(),store).save(file); fail("Expected rejection"); } catch (ApiProblem problem) { assertTrue(problem.getStatus() == 400 || problem.getStatus() == 413); }
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4097, 1, BufferedImage.TYPE_INT_RGB), "png", bytes);
        try { new ImageUploadService(folder.getRoot().toString(),store).save(new MockMultipartFile("file", "wide.png", "image/png", bytes.toByteArray())); fail("Expected dimension rejection"); }
        catch (ApiProblem problem) { assertEquals(400, problem.getStatus()); }
        assertEquals(0, folder.getRoot().list().length);
    }
    @Test public void storageReceivesNormalizedContentAndFailureDoesNotLeaveTemporaryImages() throws Exception {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB),"png",bytes);
        bytes.write("discard-this-appended-payload".getBytes("UTF-8"));
        MockMultipartFile file=new MockMultipartFile("file","../original.png","image/png",bytes.toByteArray());
        ImageUploadService uploads=new ImageUploadService(folder.getRoot().toString(),(image,name)->{
            assertTrue(name.matches("[a-f0-9]{32}\\.png"));assertNotNull(ImageIO.read(image.toFile()));
            assertFalse(new String(Files.readAllBytes(image),"ISO-8859-1").contains("discard-this-appended-payload"));return "/stored/normalized.png";
        });
        assertEquals("/stored/normalized.png",uploads.save(file));assertEquals(0,folder.getRoot().list().length);
        uploads=new ImageUploadService(folder.getRoot().toString(),(image,name)->{throw new java.io.IOException("storage unavailable");});
        try{uploads.save(file);fail("Expected failure");}catch(java.io.IOException expected){assertEquals(0,folder.getRoot().list().length);}
        LocalImageStore store=new LocalImageStore(folder.getRoot().toString());org.springframework.test.util.ReflectionTestUtils.setField(store,"mode","oss");
        try{store.validateMode();fail("Unimplemented storage must not silently use local files");}catch(IllegalStateException expected){assertTrue(expected.getMessage().contains("not implemented"));}
    }
}
