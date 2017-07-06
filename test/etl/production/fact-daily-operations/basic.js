var helper = require("../../../helper");
var Manager = require("../../../../src/etl/production/fact-daily-operations-etl-manager");
var instanceManager = null;
var should = require("should");
var sqlHelper = require("../../../sql-helper");

before("#00. connect db", function (done) {
    Promise.all([helper, sqlHelper])
        .then((result) => {
            var db = result[0];
            var sql = result[1];
            db.getDb().then((db) => {
                instanceManager = new Manager(db, {
                    username: "unit-test"
                }, sql);
                done();
            })
                .catch((e) => {
                    done(e);
                })
        });
});

it("#01. should success when create etl fact-weaving-sales-contract", function (done) {
    instanceManager.run()
        .then((a) => {
            console.log(a);
            done();
        })
        .catch((e) => {
            console.log(e);
            done(e);
        });
});

it("#02. should success when transforming data", function (done) {
    var data = [
        {
            kanban: {
                selectedProductionOrderDetail: {
                    uom: {
                        unit: "yds"
                    }
                }
            },
            input: 50,
            goodOutput: 50,
            badOutput: null
        },
        {
            kanban: {
                selectedProductionOrderDetail: {
                    uom: {
                        unit: "mtr"
                    }
                }
            },
            input: 50,
            goodOutput: 50,
            badOutput: 1
        },
        {
            kanban: {
                selectedProductionOrderDetail: {
                    uom: {
                        unit: "mtr"
                    }
                }
            },
            input: 50,
            goodOutput: 49,
            badOutput: null
        }
    ];
    instanceManager.transform(data)
        .then(() => {
            done();
        })
        .catch((e) => {
            done(e);
        });
});

// it("#03. should error when load empty data", function (done) {
//     instanceManager.load({})
//         .then(id => {
//             done("should error when create with empty data");
//         })
//         .catch(e => {
//             try {
//                 done();
//             }
//             catch (ex) {
//                 done(ex);
//             }
//         });
// });

it("#04. should error when insert empty data", function (done) {
    instanceManager.insertQuery(this.sql, "")
        .then((id) => {
            done("should error when create with empty data");
        })
        .catch((e) => {
            try {
                done();
            }
            catch (ex) {
                done(ex);
            }
        });
});