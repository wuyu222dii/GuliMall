package com.atguigu.gulimall.order;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.order.service.OrderFulfillmentService.Shipment;
import org.junit.Test;
import static org.junit.Assert.*;

public class OrderShipmentTest {
    @Test public void validatesShipmentBeforePersistingLogistics() {
        Shipment shipment=new Shipment(); shipment.setDeliveryCompany(" 顺丰速运 "); shipment.setDeliverySn(" SF123-456 "); shipment.validate();
        assertEquals("顺丰速运",shipment.getDeliveryCompany()); assertEquals("SF123-456",shipment.getDeliverySn());
        for(String company:new String[]{null," ","A\nB\rC",String.join("",java.util.Collections.nCopies(65,"字"))}) {
            shipment.setDeliveryCompany(company); shipment.setDeliverySn("SF123");
            try { shipment.validate(); fail("Invalid company accepted"); } catch(ApiProblem expected) { assertEquals(400,expected.getStatus()); }
        }
        for(String tracking:new String[]{null," ","SF 123","../123","A\nB",String.join("",java.util.Collections.nCopies(65,"A"))}) {
            shipment.setDeliveryCompany("顺丰速运"); shipment.setDeliverySn(tracking);
            try { shipment.validate(); fail("Invalid tracking accepted"); } catch(ApiProblem expected) { assertEquals(400,expected.getStatus()); }
        }
    }
}
