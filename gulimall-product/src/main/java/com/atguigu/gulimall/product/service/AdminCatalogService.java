package com.atguigu.gulimall.product.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.product.entity.*;
import com.atguigu.gulimall.product.vo.AttrVo;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class AdminCatalogService {
    @Autowired private CategoryService categories;
    @Autowired private BrandService brands;
    @Autowired private AttrGroupService groups;
    @Autowired private AttrService attrs;
    @Autowired private AttrAttrgroupRelationService relations;
    @Autowired private ProductAttrValueService productAttrs;
    @Autowired private SkuSaleAttrValueService saleAttrs;
    @Autowired private SpuInfoService spus;
    @Autowired private CategoryBrandRelationService brandRelations;

    public Map<String,Object> metadata() {
        Map<String,Object> data = new LinkedHashMap<>();
        data.put("categories", categories.listWithTree()); data.put("brands", brands.list());
        data.put("groups", groups.list()); data.put("attrs", attrs.list()); data.put("relations", relations.list());
        return data;
    }
    public List<CategoryEntity> categoryTree() { return categories.listWithTree(); }
    public com.atguigu.common.utils.PageUtils page(AdminCatalogQuery query) {
        switch(query.kind) {
            case "brands": return page(brands,query);
            case "groups": return page(groups,query);
            default: return page(attrs,query);
        }
    }
    private <T> com.atguigu.common.utils.PageUtils page(com.baomidou.mybatisplus.extension.service.IService<T> service,AdminCatalogQuery query) {
        return new com.atguigu.common.utils.PageUtils(service.page(new com.baomidou.mybatisplus.extension.plugins.pagination.Page<T>(query.page,query.limit),query.<T>conditions(false).orderByAsc(query.idColumn)));
    }
    public Object detail(String kind,Long id) {
        if(id==null || id<=0) throw new ApiProblem(400,"资料编号不正确");
        Object result;
        switch(kind) {
            case "brands": result=brands.getById(id); break;
            case "groups": result=groups.getById(id); break;
            case "attrs":
                AttrEntity attr=attrs.getById(id);
                if(attr==null) throw new ApiProblem(404,"属性不存在");
                AttrVo value=new AttrVo(); org.springframework.beans.BeanUtils.copyProperties(attr,value);
                AttrAttrgroupRelationEntity relation=relations.getOne(new QueryWrapper<AttrAttrgroupRelationEntity>().eq("attr_id",id));
                if(relation!=null) value.setAttrGroupId(relation.getAttrGroupId()); result=value; break;
            default: throw new ApiProblem(400,"资料类型不正确");
        }
        if(result==null) throw new ApiProblem(404,"资料不存在"); return result;
    }
    public Map<String,Object> position(AdminCatalogQuery query,Long id) {
        if(id==null || id<=0) throw new ApiProblem(400,"资料编号不正确");
        switch(query.kind) {
            case "brands": return position(brands,query,id);
            case "groups": return position(groups,query,id);
            default: return position(attrs,query,id);
        }
    }
    private <T> Map<String,Object> position(com.baomidou.mybatisplus.extension.service.IService<T> service,AdminCatalogQuery query,Long id) {
        boolean found=service.count(new QueryWrapper<T>().eq(query.idColumn,id))>0;
        boolean inFilter=found && service.count(query.<T>conditions(false).eq(query.idColumn,id))>0;
        int page=found?service.count(query.<T>conditions(!inFilter).lt(query.idColumn,id))/query.limit+1:1;
        Map<String,Object> result=new LinkedHashMap<>(); result.put("found",found); result.put("inFilter",inFilter); result.put("page",page); return result;
    }
    private CategoryEntity leaf(Long id) {
        CategoryEntity category = categories.getById(id);
        if (category == null || !Integer.valueOf(3).equals(category.getCatLevel())) throw new ApiProblem(400, "请选择有效的三级分类");
        return category;
    }
    private int sort(Integer value) {
        if (value != null && (value < 0 || value > 100000)) throw new ApiProblem(400, "排序范围为 0–100000");
        return value == null ? 0 : value;
    }
    @Transactional
    public Long category(CategoryEntity value) {
        if (value == null) throw new ApiProblem(400, "分类信息不能为空");
        value.setName(ProductInputs.text(value.getName(), 50, "分类名称")); value.setSort(sort(value.getSort()));
        if (value.getCatLevel() == null || value.getCatLevel() < 1 || value.getCatLevel() > 3 || value.getParentCid() == null) throw new ApiProblem(400, "分类层级不正确");
        if (value.getCatLevel() == 1) { if (value.getParentCid() != 0) throw new ApiProblem(400, "一级分类不能有父分类"); }
        else {
            CategoryEntity parent = categories.getById(value.getParentCid());
            if (parent == null || parent.getCatLevel() != value.getCatLevel() - 1) throw new ApiProblem(400, "父分类层级不正确");
        }
        value.setShowStatus(1);
        if (value.getCatId() == null) categories.save(value);
        else {
            CategoryEntity old = categories.getById(value.getCatId());
            if (old == null) throw new ApiProblem(404, "分类不存在");
            if (!Objects.equals(old.getParentCid(), value.getParentCid()) || !Objects.equals(old.getCatLevel(), value.getCatLevel())) throw new ApiProblem(409, "已有分类不能直接变更层级");
            categories.updateCascade(value);
        }
        return value.getCatId();
    }
    @Transactional
    public Long brand(BrandEntity value) {
        if (value == null) throw new ApiProblem(400, "品牌信息不能为空");
        value.setName(ProductInputs.text(value.getName(), 50, "品牌名称")); value.setSort(sort(value.getSort()));
        value.setFirstLetter(ProductInputs.text(value.getFirstLetter(), 1, "首字母").toUpperCase(Locale.ROOT));
        if (!value.getFirstLetter().matches("[A-Z]")) throw new ApiProblem(400, "首字母须为英文字母");
        if (value.getShowStatus() == null || (value.getShowStatus() != 0 && value.getShowStatus() != 1)) throw new ApiProblem(400, "品牌状态不正确");
        if (value.getLogo() == null || value.getLogo().isEmpty()) value.setLogo("/image-unavailable.svg");
        ProductInputs.image(value.getLogo());
        if (value.getBrandId() == null) brands.save(value);
        else { if (brands.getById(value.getBrandId()) == null) throw new ApiProblem(404, "品牌不存在"); brands.updateDetail(value); }
        return value.getBrandId();
    }
    @Transactional
    @CacheEvict(value = "attr", allEntries = true)
    public Long group(AttrGroupEntity value) {
        if (value == null) throw new ApiProblem(400, "分组信息不能为空");
        leaf(value.getCatelogId()); value.setAttrGroupName(ProductInputs.text(value.getAttrGroupName(), 100, "分组名称")); value.setSort(sort(value.getSort()));
        if (value.getAttrGroupId() == null) groups.save(value);
        else {
            AttrGroupEntity old = groups.getById(value.getAttrGroupId());
            if (old == null) throw new ApiProblem(404, "分组不存在");
            if (!Objects.equals(old.getCatelogId(), value.getCatelogId())) throw new ApiProblem(409, "已有分组不能直接移动分类");
            groups.updateById(value);
        }
        return value.getAttrGroupId();
    }
    @Transactional
    @CacheEvict(value = "attr", allEntries = true)
    public Long attribute(AttrVo value) {
        if (value == null) throw new ApiProblem(400, "属性信息不能为空");
        leaf(value.getCatelogId()); value.setAttrName(ProductInputs.text(value.getAttrName(), 100, "属性名称"));
        if (value.getAttrType() == null || (value.getAttrType() != 0 && value.getAttrType() != 1)) throw new ApiProblem(400, "属性类型不正确");
        if (value.getEnable() == null || (value.getEnable() != 0 && value.getEnable() != 1)) throw new ApiProblem(400, "启用状态不正确");
        if (value.getValueSelect() != null && value.getValueSelect().length() > 255) throw new ApiProblem(400, "可选值过长");
        value.setSearchType(0); value.setValueType(0); value.setShowDesc(1);
        if (value.getAttrType() == 1) {
            AttrGroupEntity group = groups.getById(value.getAttrGroupId());
            if (group == null || !Objects.equals(group.getCatelogId(), value.getCatelogId())) throw new ApiProblem(400, "基础属性须选择同分类分组");
        } else value.setAttrGroupId(null);
        if (value.getAttrId() == null) attrs.saveAttr(value);
        else {
            AttrEntity old = attrs.getById(value.getAttrId());
            if (old == null) throw new ApiProblem(404, "属性不存在");
            if (!Objects.equals(old.getCatelogId(), value.getCatelogId()) || !Objects.equals(old.getAttrType(), value.getAttrType())) throw new ApiProblem(409, "已有属性不能直接更改分类或类型");
            attrs.updateAttr(value);
            productAttrs.update(new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<ProductAttrValueEntity>().eq("attr_id", value.getAttrId()).set("attr_name", value.getAttrName()));
            saleAttrs.update(new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<SkuSaleAttrValueEntity>().eq("attr_id", value.getAttrId()).set("attr_name", value.getAttrName()));
        }
        return value.getAttrId();
    }
    @Transactional
    @CacheEvict(value = {"category", "attr"}, allEntries = true)
    public void delete(String kind, Long id) {
        switch (kind) {
            case "categories":
                if (attrs.count(new QueryWrapper<AttrEntity>().eq("catelog_id", id)) > 0 || groups.count(new QueryWrapper<AttrGroupEntity>().eq("catelog_id", id)) > 0) throw new ApiProblem(409, "请先处理分类下的属性和分组");
                categories.removeMenuByIds(Collections.singletonList(id)); brandRelations.remove(new QueryWrapper<CategoryBrandRelationEntity>().eq("catelog_id", id)); break;
            case "brands":
                if (spus.count(new QueryWrapper<SpuInfoEntity>().eq("brand_id", id)) > 0) throw new ApiProblem(409, "品牌已有商品，不能删除");
                brands.removeById(id); brandRelations.remove(new QueryWrapper<CategoryBrandRelationEntity>().eq("brand_id", id)); break;
            case "groups":
                if (relations.count(new QueryWrapper<AttrAttrgroupRelationEntity>().eq("attr_group_id", id)) > 0) throw new ApiProblem(409, "分组仍有关联属性，不能删除");
                groups.removeById(id); break;
            case "attrs":
                if (productAttrs.count(new QueryWrapper<ProductAttrValueEntity>().eq("attr_id", id)) > 0 || saleAttrs.count(new QueryWrapper<SkuSaleAttrValueEntity>().eq("attr_id", id)) > 0) throw new ApiProblem(409, "属性已被商品使用，不能删除");
                relations.remove(new QueryWrapper<AttrAttrgroupRelationEntity>().eq("attr_id", id)); attrs.removeById(id); break;
            default: throw new ApiProblem(400, "维护类型不正确");
        }
    }
}
