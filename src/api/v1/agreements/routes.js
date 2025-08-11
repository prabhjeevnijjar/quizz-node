const agreementsRouter = require("express").Router();
const prisma = require("../../../../prisma/prismaClient");
const { sendAgreementEmail } = require("../../../helper/mailer");
const authMiddleware = require("../../../middleware/authMiddleware");
const crypto = require('crypto');

// Helper function to generate a random signing token
function generateSigningToken() {
  return crypto.randomBytes(32).toString('hex');
}
// Apply auth middleware to all routes
agreementsRouter.use(authMiddleware);

// get all agreements with pagination
// agreementsRouter.get("/", async (req, res) => {
//   try {
//     const { page = 1, limit = 10, status } = req.query;
//     const userId = req.user.id;
    
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Build where clause
//     const whereClause = {
//       creatorId: userId,
//       ...(status && { status })
//     };

//     // Get agreements with pagination
//     const [agreements, totalCount] = await Promise.all([
//       prisma.agreement.findMany({
//         where: whereClause,
//         include: {
//           creator: {
//             select: {
//               id: true,
//               email: true,
//               name: true
//             }
//           },
//           signers: {
//             select: {
//               id: true,
//               signerEmail: true,
//               signerName: true,
//               status: true,
//               signedAt: true
//             }
//           },
//           _count: {
//             select: {
//               signers: true,
//               trails: true
//             }
//           }
//         },
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take: limitNum
//       }),
//       prisma.agreement.count({ where: whereClause })
//     ]);

//     const totalPages = Math.ceil(totalCount / limitNum);

//     res.json({
//       status: "success",
//       data: {
//         agreements,
//         pagination: {
//           currentPage: pageNum,
//           totalPages,
//           totalCount,
//           hasNext: pageNum < totalPages,
//           hasPrev: pageNum > 1
//         }
//       },
//       message: "Data fetch success"
//     });
//   } catch (error) {
//     console.error("Error fetching agreements:", error);
//     res.status(500).json({
//       status: "failure",
//       data: null,
//       message: "Failed to fetch agreements"
//     });
//   }
// });

// create a new agreement
// BODY
// {
//     "name": "Service Agreement",
//     "receivers": [
//       { "email": "alice@example.com", "name": "Alice" },
//       { "email": "bob@example.com", "name": "Bob" }
//     ],
//     "fileUrl": "fileUrl",
//     "mimeType": "application/pdf",
//     "fileSize": "456789",
//     "originalFilename": "agreement.pdf",
//     "signatureCoords": "{}"
//   }
  
// Steps
// 1. Validate required fields
// 2. create an agreement in the database
agreementsRouter.post("/", async (req, res) => {
    try {
        console.log("BODY", req.body)
      const {
        name,
        receivers, // Array of { email, name }
        fileUrl,   
        originalFilename,
        signatureCoords // Array of coords
      } = req.body;
  
      const userId = req.user.id;

      if (!name || !receivers || !Array.isArray(receivers) || receivers.length === 0) {
        return res.status(400).json({
          status: "failure",
          data: null,
          message: "Name and at least one receiver are required"
        });
      }
  
      const existingAgreement = await prisma.agreement.findFirst({
        where: {
          name,
          creatorId: userId
        }
      });
  
      if (existingAgreement) {
        return res.status(409).json({
          status: "failure",
          data: null,
          message: "An agreement with this name already exists"
        });
      }
  
      const agreement = await prisma.agreement.create({
        data: {
          name,
          creatorId: userId,
          status: 'CREATED',
          fileUrl,
          originalFilename,
          signatureCoords
        },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
  
      // Create AgreementSigner entries
      await prisma.agreementSigner.createMany({
        data: receivers.map(({ email, name }) => ({
          agreementId: agreement.id,
          signerEmail: email,
          signerName: name,
          status: "PENDING"
        }))
      });
  
      // Log activity in trail
      await prisma.agreementTrail.create({
        data: {
          agreementId: agreement.id,
          actorId: userId,
          actorRole: 'CREATOR',
          actorAction: 'CREATED',
          ipAddress: req.ip //TODO check if i get the IP
        }
      });
      // TODO
      // generate a new SigningToken with an expiry of 5 days for each receiver
      // send email to all receivers include the respective signing token in URL
      // update the agreementTrail DB with the SENT

    
      res.status(201).json({
        status: "success",
        data: agreement,
        message: "Agreement created successfully"
      });
    } catch (error) {
      console.error("Error creating agreement:", error);
      res.status(500).json({
        status: "failure",
        data: null,
        message: "Failed to create agreement"
      });
    }
});
  
  

// get a specific agreement by ID
// agreementsRouter.get("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     const agreementId = parseInt(id);
//     if (isNaN(agreementId)) {
//       return res.status(400).json({
//         status: "failure",
//         data: null,
//         message: "Invalid agreement ID"
//       });
//     }

//     const agreement = await prisma.agreement.findFirst({
//       where: {
//         id: agreementId,
//         creatorId: userId
//       },
//       include: {
//         creator: {
//           select: {
//             id: true,
//             email: true,
//             name: true
//           }
//         },
//         signers: {
//           select: {
//             id: true,
//             signerEmail: true,
//             signerName: true,
//             status: true,
//             signedAt: true,
//             signatureCoords: true
//           }
//         },
//         trails: {
//           include: {
//             actor: {
//               select: {
//                 id: true,
//                 email: true,
//                 name: true
//               }
//             }
//           },
//           orderBy: { createdAt: 'desc' }
//         },
//         signingTokens: {
//           select: {
//             id: true,
//             signerEmail: true,
//             token: true,
//             expiresAt: true,
//             usedAt: true
//           }
//         }
//       }
//     });

//     if (!agreement) {
//       return res.status(404).json({
//         status: "failure",
//         data: null,
//         message: "Agreement not found"
//       });
//     }

//     res.json({
//       status: "success",
//       data: agreement,
//       message: "Data fetch success"
//     });
//   } catch (error) {
//     console.error("Error fetching agreement:", error);
//     res.status(500).json({
//       status: "failure",
//       data: null,
//       message: "Failed to fetch agreement"
//     });
//   }
// });

// // delete an agreement
// agreementsRouter.delete("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     const agreementId = parseInt(id);
//     if (isNaN(agreementId)) {
//       return res.status(400).json({
//         status: "failure",
//         data: null,
//         message: "Invalid agreement ID"
//       });
//     }

//     // Check if agreement exists and belongs to user
//     const agreement = await prisma.agreement.findFirst({
//       where: {
//         id: agreementId,
//         creatorId: userId
//       }
//     });

//     if (!agreement) {
//       return res.status(404).json({
//         status: "failure",
//         data: null,
//         message: "Agreement not found"
//       });
//     }

//     // Delete related records first (due to foreign key constraints)
//     await prisma.$transaction([
//       prisma.agreementTrail.deleteMany({ where: { agreementId } }),
//       prisma.signingToken.deleteMany({ where: { agreementId } }),
//       prisma.agreementSigner.deleteMany({ where: { agreementId } }),
//       prisma.agreement.delete({ where: { id: agreementId } })
//     ]);

//     res.json({
//       status: "success",
//       data: null,
//       message: "Agreement deleted successfully"
//     });
//   } catch (error) {
//     console.error("Error deleting agreement:", error);
//     res.status(500).json({
//       status: "failure",
//       data: null,
//       message: "Failed to delete agreement"
//     });
//   }
// });

module.exports = agreementsRouter;
