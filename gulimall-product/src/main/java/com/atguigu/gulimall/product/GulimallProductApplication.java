package com.atguigu.gulimall.product;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
/**
 * 1, integrationMyBatis-Plus
 *      1), import dependencies
 *      <dependency>
 *             <groupId>com.baomidou</groupId>
 *             <artifactId>mybatis-plus-boot-starter</artifactId>
 *             <version>3.2.0</version>
 *      </dependency>
 *      2), configuration
 *          1, configure the data source;
 *              1), import the driver of the database.https://dev.mysql.com/doc/connector-j/8.0/en/connector-j-versions.html
 *              2),existapplication.ymlConfigure data source related information
 *          2, configurationMyBatis-Plus;
 *              1),use@MapperScan
 *              2),TellMyBatis-Plus,sqlMap file location
 *
 * 2, logical deletion
 *  1), configure global tombstone rules (omitted)
 *  2), configure logically deleted componentsBean(omitted)
 *  3),GiveBeanAdd logical deletion annotation@TableLogic
 *
 * 3,JSR303
 *   1),GiveBeanAdd verification annotation:javax.validation.constraints, and define your ownmessagehint
 *   2), turn on the verification function@Valid
 *      Effect: There will be a default response after verification error;
 *   3), for verificationbeanfollowed by oneBindingResult, you can get the verification result
 *   4), group verification (complex verification of multiple scenarios)
 *         1),	@NotBlank(message = "Brand name is required",groups = {AddGroup.class,UpdateGroup.class})
 *          Mark the verification annotation as to what situations need to be verified.
 *         2),@Validated({AddGroup.class})
 *         3), by default there is no verification annotation for the specified group.@NotBlank, in the case of group verification@Validated({AddGroup.class})It will not take effect under@Validatedtake effect;
 *
 *   5), custom verification
 *      1), write a custom verification annotation
 *      2), write a custom validator ConstraintValidator
 *      3), associate custom validators and custom validation annotations
 *      @Documented
 * @Constraint(validatedBy = { ListValueConstraintValidator.class[You can specify multiple different validators to adapt to different types of verification] })
 * @Target({ METHOD, FIELD, ANNOTATION_TYPE, CONSTRUCTOR, PARAMETER, TYPE_USE })
 * @Retention(RUNTIME)
 * public @interface ListValue {
 *
 * 4, unified exception handling
 * @ControllerAdvice
 *  1), write exception handling class, use@ControllerAdvice.
 *  2),use@ExceptionHandlerAnnotation methods can handle exceptions.
 */
@EnableCaching
@EnableFeignClients(basePackages = "com.atguigu.gulimall.product.feign")
@SpringBootApplication
@MapperScan("com.atguigu.gulimall.product.dao")
@EnableDiscoveryClient
public class GulimallProductApplication {

    public static void main(String[] args) {
        SpringApplication.run(GulimallProductApplication.class, args);
    }

}
