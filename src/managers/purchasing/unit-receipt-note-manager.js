'use strict'
var ObjectId = require("mongodb").ObjectId;
require('mongodb-toolkit');
var DLModels = require('dl-models');
var assert = require('assert');
var map = DLModels.map;
var i18n = require('dl-i18n');
var UnitReceiptNote = DLModels.purchasing.UnitReceiptNote;
var PurchaseOrderManager = require('./purchase-order-manager');
var BaseManager = require('../base-manager');

module.exports = class UnitReceiptNoteManager extends BaseManager {
    constructor(db, user) {
        super(db, user);
        this.collection = this.db.use(map.purchasing.collection.UnitReceiptNote);
        this.purchaseOrderManager = new PurchaseOrderManager(db, user);
    }

    _validate(unitReceiptNote) {
        var errors = {};
        return new Promise((resolve, reject) => {
            var valid = unitReceiptNote;

            var getUnitReceiptNotePromise = this.collection.singleOrDefault({
                "$and": [{
                    _id: {
                        '$ne': new ObjectId(valid._id)
                    }
                }, {
                        "no": valid.no
                    }]
            });

            Promise.all([getUnitReceiptNotePromise])
                .then(results => {
                    var _module = results[0];
                    var now = new Date();

                    if (!valid.no || valid.no == '')
                        errors["no"] = i18n.__("UnitReceiptNote.no.isRequired:%s is required", i18n.__("UnitReceiptNote.no._:No")); //No. bon unit tidak boleh kosong";
                    else if (_module)
                        errors["no"] = i18n.__("UnitReceiptNote.no.isExists:%s is already exists", i18n.__("UnitReceiptNote.no._:No")); //"No. bon unit sudah terdaftar";

                    if (!valid.unitId)
                        errors["unit"] = i18n.__("UnitReceiptNote.unit.isRequired:%s is required", i18n.__("UnitReceiptNote.unit._:Unit")); //"Unit tidak boleh kosong";
                    else if (valid.unit) {
                        if (!valid.unit._id)
                            errors["unit"] = i18n.__("UnitReceiptNote.unit.isRequired:%s is required", i18n.__("UnitReceiptNote.unit._:Unit")); //"Unit tidak boleh kosong";
                    }
                    else if (!valid.unit)
                        errors["unit"] =  i18n.__("UnitReceiptNote.unit.isRequired:%s is required", i18n.__("UnitReceiptNote.unit._:Unit")); //"Unit tidak boleh kosong";

                    if (!valid.supplierId)
                        errors["supplier"] = i18n.__("UnitReceiptNote.supplier.isRequired:%s name is required", i18n.__("UnitReceiptNote.supplier._:Supplier")); //"Nama supplier tidak boleh kosong";
                    else if (valid.supplier) {
                        if (!valid.supplier._id)
                            errors["supplier"] = i18n.__("UnitReceiptNote.supplier.isRequired:%s name is required", i18n.__("UnitReceiptNote.supplier._:Supplier")); //"Nama supplier tidak boleh kosong";
                    }
                    else if (!valid.supplier)
                        errors["supplier"] = i18n.__("UnitReceiptNote.supplier.isRequired:%s name is required", i18n.__("UnitReceiptNote.supplier._:Supplier")); //"Nama supplier tidak boleh kosong";

                    if (!valid.deliveryOrderId)
                        errors["deliveryOrder"] = i18n.__("UnitReceiptNote.deliveryOrder.isRequired:%s is required", i18n.__("UnitReceiptNote.deliveryOrder._:Delivery Order No.")); //"No. surat jalan tidak boleh kosong";
                    else if (valid.deliveryOrder) {
                        if (!valid.deliveryOrder._id)
                            errors["deliveryOrder"] = i18n.__("UnitReceiptNote.deliveryOrder.isRequired:%s is required", i18n.__("UnitReceiptNote.deliveryOrder._:Delivery Order No")); //"No. surat jalan tidak boleh kosong";
                    }
                    else if (!valid.deliveryOrder)
                        errors["deliveryOrder"] = i18n.__("UnitReceiptNote.deliveryOrder.isRequired:%s is required", i18n.__("UnitReceiptNote.deliveryOrder._:Delivery Order No")); //"No. surat jalan tidak boleh kosong";

                    if (valid.items) {
                        if (valid.items.length <= 0) {
                            errors["items"] =  i18n.__("UnitReceiptNote.items.isRequired:%s is required", i18n.__("UnitReceiptNote.items._:Item")); //"Harus ada minimal 1 barang";
                        }
                        else {
                            var itemErrors = [];
                            for (var item of valid.items) {
                                var itemError = {};
                                if (item.deliveredQuantity <= 0)
                                    itemError["deliveredQuantity"] = i18n.__("UnitReceiptNote.items.deliveredQuantity.isRequired:%s is required", i18n.__("UnitReceiptNote.items.deliveredQuantity._:Delivered Quantity")); //Jumlah barang tidak boleh kosong";
                                itemErrors.push(itemError);
                            }
                            for (var itemError of itemErrors) {
                                for (var prop in itemError) {
                                    errors.items = itemErrors;
                                    break;
                                }
                                if (errors.items)
                                    break;
                            }
                        }
                    }
                    else {
                        errors["items"] = i18n.__("UnitReceiptNote.items.isRequired:%s is required", i18n.__("UnitReceiptNote.items._:Item")); //"Harus ada minimal 1 barang";
                    }

                    if (Object.getOwnPropertyNames(errors).length > 0) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    valid.unitId = new ObjectId(valid.unitId);
                    valid.supplierId = new ObjectId(valid.supplierId);
                    valid.deliveryOrderId = new ObjectId(valid.deliveryOrderId);
                    valid.deliveryOrder.supplierId = new ObjectId(valid.deliveryOrder.supplierId);
                    for (var doItem of valid.deliveryOrder.items)
                    {
                        doItem.purchaseOrderExternalId = new ObjectId(doItem.purchaseOrderExternalId);
                        for(var fulfillment of doItem.fulfillments)
                        {
                            fulfillment.purchaseOrderId = new ObjectId(fulfillment.purchaseOrderId);
                            fulfillment.productId = new ObjectId(fulfillment.productId);
                        }
                    }
                    
                    for (var item of valid.items)
                        item.product._id = new ObjectId(item.product._id);
                    
                    if (!valid.stamp)
                        valid = new UnitReceiptNote(valid);

                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                })

        });
    }

    _getQuery(paging) {
        var filter = {
            _deleted: false
        };

        var query = paging.keyword ? {
            '$and': [filter]
        } : filter;

        if (paging.keyword) {
            var regex = new RegExp(paging.keyword, "i");

            var filterNo = {
                'no': {
                    '$regex': regex
                }
            };

            var filterSupplierName = {
                'supplier.name': {
                    '$regex': regex
                }
            };

            var filterUnitDivision = {
                "unit.division": {
                    '$regex': regex
                }
            };
            var filterUnitSubDivision = {
                "unit.subDivision": {
                    '$regex': regex
                }
            };

            var filterDeliveryOrder = {
                "deliveryOrder.no": {
                    '$regex': regex
                }
            };

            var $or = {
                '$or': [filterNo, filterSupplierName, filterUnitDivision, filterUnitSubDivision, filterDeliveryOrder]
            };

            query['$and'].push($or);
        }
        return query;
    }

    create(unitReceiptNote) {
        return new Promise((resolve, reject) => {
            var tasks = [];
            var tasksPoExternal = [];
            var getPurchaseOrderById = [];
            this._validate(unitReceiptNote)
                .then(validUnitReceiptNote => {
                    validUnitReceiptNote.unitId = new ObjectId(validUnitReceiptNote.unitId);
                    validUnitReceiptNote.supplierId = new ObjectId(validUnitReceiptNote.supplierId);
                    validUnitReceiptNote.deliveryOrderId = new ObjectId(validUnitReceiptNote.deliveryOrderId);
                    this.collection.insert(validUnitReceiptNote)
                        .then(id => {
                            //update PO Internal
                            for (var doItem of validUnitReceiptNote.deliveryOrder.items) {
                                for (var fulfillment of doItem.fulfillments)
                                    getPurchaseOrderById.push(this.purchaseOrderManager.getSingleById(fulfillment.purchaseOrder._id));
                            }
                            Promise.all(getPurchaseOrderById)
                                .then(results => {
                                    for (var result of results) {
                                        var purchaseOrder = result;
                                        for (var poItem of purchaseOrder.items) {
                                            for (var unitReceiptNoteItem of validUnitReceiptNote.items) {
                                                if (validUnitReceiptNote.unitId.equals(purchaseOrder.unitId)) {
                                                    if (unitReceiptNoteItem.product._id.equals(poItem.product._id)) {
                                                        for (var fulfillment of poItem.fulfillments) {
                                                            var fulfillmentNo = fulfillment.deliveryOderNo || '';
                                                            var deliveryOrderNo = validUnitReceiptNote.deliveryOrder.no || '';

                                                            if (fulfillmentNo == deliveryOrderNo) {
                                                                fulfillment.unitReceiptNoteNo = validUnitReceiptNote.no;
                                                                fulfillment.unitReceiptNoteDate = validUnitReceiptNote.date;
                                                                fulfillment.unitReceiptNoteDeliveredQuantity = unitReceiptNoteItem.deliveredQuantity;
                                                                fulfillment.unitReceiptDeliveredUom = unitReceiptNoteItem.deliveredUom;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        tasks.push(this.purchaseOrderManager.update(purchaseOrder));
                                    }

                                    Promise.all(tasks)
                                        .then(results => {
                                            resolve(id);
                                        })
                                        .catch(e => {
                                            reject(e);
                                        })

                                })
                                .catch(e => {
                                    reject(e);
                                });
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
    
    pdf(id) {
        return new Promise((resolve, reject) => {

            this.getSingleById(id)
                .then(unitReceiptNote => {
                    var getDefinition = require('../../pdf/definitions/unit-receipt-note');
                    var definition = getDefinition(unitReceiptNote);

                    var generatePdf = require('../../pdf/pdf-generator');
                    generatePdf(definition)
                        .then(binary => {
                            resolve(binary);
                        })
                        .catch(e => {
                            reject(e);
                        });
                })
                .catch(e => {
                    reject(e);
                });

        });
    }
    
    getDataUnitReceiptNote(no, supplierId, dateFrom, dateTo) {
        return new Promise((resolve, reject) => {
            var query;
            if (no != "undefined" && no != "" && supplierId != "undefined" && supplierId != "" && dateFrom != "undefined" && dateFrom != "" && dateTo != "undefined" && dateTo != "") {
                query = {
                    no: no,
                    supplierId: new ObjectId(supplierId),
                    date:
                    {
                        $gte: dateFrom,
                        $lte: dateTo
                    },
                    _deleted: false
                };
            } else if (no != "undefined" && no != "" && supplierId != "undefined" && supplierId != "") {
                query = {
                    no: no,
                    supplierId: new ObjectId(supplierId),
                    _deleted: false
                };
            } else if (supplierId != "undefined" && supplierId != "") {
                query = {
                    supplierId: new ObjectId(supplierId),
                    _deleted: false
                };
            } else if (no != "undefined" && no != "") {
                query = {
                    no: no,
                    _deleted: false
                };
            } else if (dateFrom != "undefined" && dateFrom != "" && dateTo != "undefined" && dateTo != "") {
                query = {
                    date:
                    {
                        $gte: dateFrom,
                        $lte: dateTo
                    },
                    _deleted: false
                };
            }

            this.collection
                .where(query)
                .execute()
                .then(unitReceiptNote => {
                    resolve(unitReceiptNote);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

}