const Component = require('../models/Component');
const BorrowRecord = require('../models/BorrowRecord');
const { auditLogger } = require('../events/auditLogger');

// @desc    Get all components with search & filter
// @route   GET /api/components
// @access  Public
const getComponents = async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { specifications: searchRegex },
        { labRoom: searchRegex },
        { category: searchRegex }
      ];
    }

    const components = await Component.find(query).sort({ category: 1, name: 1 });
    const count = await Component.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      components
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single component by ID
// @route   GET /api/components/:id
// @access  Public
const getComponentById = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Component not found.'
      });
    }

    res.status(200).json({
      success: true,
      component
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new component
// @route   POST /api/components
// @access  Private/Admin
const createComponent = async (req, res, next) => {
  try {
    const {
      name,
      category,
      labRoom,
      totalStock,
      availableStock,
      specifications,
      description,
      imageUrl
    } = req.body;

    const total = Number(totalStock);
    const available = availableStock !== undefined ? Number(availableStock) : total;

    if (!name || !category || isNaN(total)) {
      return res.status(400).json({
        success: false,
        message: 'Component name, category, and total stock are required.'
      });
    }

    if (available > total) {
      return res.status(400).json({
        success: false,
        message: 'Available stock cannot exceed total stock.'
      });
    }

    const component = await Component.create({
      name,
      category,
      labRoom: labRoom || 'Lab 302 - Embedded Systems & IoT',
      totalStock: total,
      availableStock: available,
      specifications: specifications || 'Standard laboratory specification',
      description: description || '',
      imageUrl: imageUrl || ''
    });

    // Emit event for native EventEmitter audit logger
    auditLogger.emit('component:created', {
      component,
      admin: req.user
    });

    res.status(201).json({
      success: true,
      message: 'Component created successfully.',
      component
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update component
// @route   PUT /api/components/:id
// @access  Private/Admin
const updateComponent = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Component not found.'
      });
    }

    const {
      name,
      category,
      labRoom,
      totalStock,
      availableStock,
      specifications,
      description,
      imageUrl,
      status
    } = req.body;

    if (name) component.name = name;
    if (category) component.category = category;
    if (labRoom) component.labRoom = labRoom;
    if (specifications !== undefined) component.specifications = specifications;
    if (description !== undefined) component.description = description;
    if (imageUrl !== undefined) component.imageUrl = imageUrl;

    if (totalStock !== undefined) {
      component.totalStock = Number(totalStock);
    }
    if (availableStock !== undefined) {
      component.availableStock = Number(availableStock);
    }

    if (component.availableStock > component.totalStock) {
      return res.status(400).json({
        success: false,
        message: 'Available stock cannot exceed total stock.'
      });
    }

    if (status) {
      component.status = status;
    }

    await component.save();

    // Emit audit event
    auditLogger.emit('component:updated', {
      component,
      admin: req.user,
      details: `Stock updated: ${component.availableStock}/${component.totalStock}`
    });

    res.status(200).json({
      success: true,
      message: 'Component updated successfully.',
      component
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete component
// @route   DELETE /api/components/:id
// @access  Private/Admin
const deleteComponent = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Component not found.'
      });
    }

    // Check if active borrow records exist for this component
    const activeBorrowings = await BorrowRecord.countDocuments({
      component: component._id,
      status: { $in: ['Requested', 'Issued', 'Overdue'] }
    });

    if (activeBorrowings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete "${component.name}" because ${activeBorrowings} active borrowing loan(s) are currently outstanding.`
      });
    }

    const componentName = component.name;
    await component.deleteOne();

    // Emit audit event
    auditLogger.emit('component:deleted', {
      componentName,
      admin: req.user
    });

    res.status(200).json({
      success: true,
      message: `Component "${componentName}" was deleted successfully.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unit 4 MongoDB Aggregation Pipeline for Category Stock & Department Usage Stats
// @route   GET /api/components/analytics
// @access  Public or Protected
const getAnalytics = async (req, res, next) => {
  try {
    // Pipeline 1: Category-wise stock aggregation ($group, $sum, $project, $sort)
    const categoryStats = await Component.aggregate([
      {
        $group: {
          _id: '$category',
          totalItemsCount: { $sum: 1 },
          totalStockUnits: { $sum: '$totalStock' },
          availableStockUnits: { $sum: '$availableStock' },
          borrowedStockUnits: {
            $sum: { $subtract: ['$totalStock', '$availableStock'] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalItemsCount: 1,
          totalStockUnits: 1,
          availableStockUnits: 1,
          borrowedStockUnits: 1,
          utilizationPercentage: {
            $cond: [
              { $eq: ['$totalStockUnits', 0] },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: ['$totalStockUnits', '$availableStockUnits'] },
                          '$totalStockUnits'
                        ]
                      },
                      100
                    ]
                  },
                  1
                ]
              }
            ]
          }
        }
      },
      {
        $sort: { totalStockUnits: -1 }
      }
    ]);

    // Pipeline 2: Department-wise hardware borrowing aggregation ($lookup, $unwind, $group, $project)
    const departmentStats = await BorrowRecord.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'borrower'
        }
      },
      {
        $unwind: '$borrower'
      },
      {
        $group: {
          _id: '$borrower.department',
          totalTransactions: { $sum: 1 },
          totalUnitsRequested: { $sum: '$quantity' },
          activeBorrows: {
            $sum: {
              $cond: [{ $in: ['$status', ['Issued', 'Requested', 'Overdue']] }, '$quantity', 0]
            }
          },
          returnedBorrows: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Returned'] }, '$quantity', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          totalTransactions: 1,
          totalUnitsRequested: 1,
          activeBorrows: 1,
          returnedBorrows: 1
        }
      },
      {
        $sort: { totalUnitsRequested: -1 }
      }
    ]);

    // Pipeline 3: Overall System Metrics ($group summary)
    const summaryAggregation = await Component.aggregate([
      {
        $group: {
          _id: null,
          totalDistinctItems: { $sum: 1 },
          totalAssets: { $sum: '$totalStock' },
          totalAvailable: { $sum: '$availableStock' },
          outOfStockCount: {
            $sum: { $cond: [{ $lte: ['$availableStock', 0] }, 1, 0] }
          }
        }
      }
    ]);

    const activeLoans = await BorrowRecord.countDocuments({
      status: { $in: ['Issued', 'Requested'] }
    });

    const overdueCount = await BorrowRecord.countDocuments({
      status: { $in: ['Issued', 'Overdue'] },
      expectedReturnDate: { $lt: new Date() }
    });

    const summary = summaryAggregation[0] || {
      totalDistinctItems: 0,
      totalAssets: 0,
      totalAvailable: 0,
      outOfStockCount: 0
    };

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalDistinctItems: summary.totalDistinctItems,
          totalAssets: summary.totalAssets,
          totalAvailable: summary.totalAvailable,
          totalBorrowed: summary.totalAssets - summary.totalAvailable,
          outOfStockCount: summary.outOfStockCount,
          activeLoans,
          overdueCount
        },
        categoryStats,
        departmentStats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getAnalytics
};
