import {
  GraphQLBoolean, GraphQLEnumType, GraphQLFloat, GraphQLID, GraphQLInputObjectType, GraphQLInt,
  GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLSchema,
  GraphQLString, valueFromASTUntyped,
} from 'graphql';
import { login, type AuthContext } from '../services/auth.js';
import { applyOfflineOperation, type OfflineInput } from '../services/operations.js';
import {
  branches, branchPermissions, cancelledCredits, customerByDocument, customerById,
  defaultersOfPortfolio, me, paymentHistory, portfolio, portfolioClients, receiptSequences,
  restoreCredit, syncChanges, withdrawnOfPortfolio,
} from '../services/queries.js';
import { fail } from '../services/errors.js';
import { z } from 'zod';

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON object or scalar value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => valueFromASTUntyped(ast),
});

const BranchType = new GraphQLObjectType({
  name: 'Branch',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: GraphQLString },
    extraCharge: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const userFields = {
    userId: { type: new GraphQLNonNull(GraphQLInt) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    employeeId: { type: GraphQLInt },
    username: { type: new GraphQLNonNull(GraphQLString) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    companyName: { type: new GraphQLNonNull(GraphQLString) },
};

const BasicUserType = new GraphQLObjectType({
  name: 'UserBasics',
  fields: userFields,
});

const AuthContextType = new GraphQLObjectType({
  name: 'AuthenticatedUser',
  fields: {
    ...userFields,
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))) },
  },
});

const AuthPayloadType = new GraphQLObjectType({
  name: 'AuthPayload',
  fields: {
    token: { type: new GraphQLNonNull(GraphQLString) },
    expiresIn: { type: new GraphQLNonNull(GraphQLInt) },
    user: { type: new GraphQLNonNull(BasicUserType) },
    company: { type: new GraphQLNonNull(new GraphQLObjectType({
      name: 'CompanyBasics',
      fields: {
        id: { type: new GraphQLNonNull(GraphQLInt) },
        name: { type: new GraphQLNonNull(GraphQLString) },
      },
    })) },
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))) },
  },
});

const PaymentType = new GraphQLObjectType({
  name: 'Payment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) }, creditId: { type: new GraphQLNonNull(GraphQLID) },
    amount: { type: new GraphQLNonNull(GraphQLFloat) }, description: { type: GraphQLString },
    state: { type: GraphQLString }, createdAt: { type: GraphQLString }, updatedAt: { type: GraphQLString },
    routeId: { type: GraphQLInt },
    createdByUserId: { type: GraphQLInt }, createdByUsername: { type: GraphQLString },
    origin: { type: GraphQLString },
  },
});

const ReceiptSequenceType = new GraphQLObjectType({
  name: 'ReceiptSequence',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    documentType: { type: new GraphQLNonNull(GraphQLString) },
    series: { type: GraphQLString },
    lastNumber: { type: GraphQLString },
  },
});

const CreditType = new GraphQLObjectType({
  name: 'Credit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    branchId: { type: new GraphQLNonNull(GraphQLInt) },
    customerId: { type: new GraphQLNonNull(GraphQLInt) },
    routeId: { type: new GraphQLNonNull(GraphQLInt) },
    saleId: { type: GraphQLInt },
    concept: { type: GraphQLString }, value: { type: GraphQLFloat },
    frequency: { type: GraphQLString }, term: { type: GraphQLInt },
    principal: { type: GraphQLFloat }, balance: { type: GraphQLFloat },
    description: { type: GraphQLString }, sortOrder: { type: GraphQLFloat },
    profit: { type: GraphQLFloat }, additionalNumber: { type: GraphQLString },
    additionalValue: { type: GraphQLFloat }, receiptType: { type: GraphQLString },
    receiptSeries: { type: GraphQLString }, receiptNumber: { type: GraphQLString },
    paymentSummary: { type: GraphQLString }, style: { type: GraphQLString },
    note: { type: GraphQLString }, status: { type: GraphQLString },
    createdEmployeeId: { type: GraphQLInt }, agreementDate: { type: GraphQLString },
    createdAt: { type: GraphQLString }, updatedAt: { type: GraphQLString },
    latestPayment: { type: PaymentType },
  },
});

const CommentType = new GraphQLObjectType({
  name: 'CustomerComment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    customerId: { type: new GraphQLNonNull(GraphQLInt) },
    comment: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    userId: { type: new GraphQLNonNull(GraphQLInt) },
    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString },
  },
});

const CustomerType = new GraphQLObjectType({
  name: 'Customer',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    companyId: { type: new GraphQLNonNull(GraphQLInt) },
    personId: { type: new GraphQLNonNull(GraphQLInt) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    sex: { type: GraphQLString }, birthDate: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, email: { type: GraphQLString }, photo: { type: GraphQLString },
    occupation: { type: GraphQLString }, personStatus: { type: GraphQLString },
    personNote: { type: GraphQLString }, department: { type: GraphQLString },
    city: { type: GraphQLString }, neighborhood: { type: GraphQLString }, street: { type: GraphQLString },
    maxCredit: { type: GraphQLFloat }, nickname: { type: GraphQLString }, note: { type: GraphQLString },
    status: { type: GraphQLString }, rating: { type: GraphQLString }, guarantorPersonId: { type: GraphQLInt },
    credits: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CreditType))) },
    comments: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CommentType))) },
  },
});

const PortfolioType = new GraphQLObjectType({
  name: 'PortfolioPage',
  fields: {
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CustomerType))) },
    snapshotCursor: { type: new GraphQLNonNull(GraphQLString) },
    nextCursor: { type: GraphQLString },
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const ChangeType = new GraphQLObjectType({
  name: 'SyncChange',
  fields: {
    cursor: { type: new GraphQLNonNull(GraphQLString) },
    recordType: { type: new GraphQLNonNull(GraphQLString) },
    recordId: { type: new GraphQLNonNull(GraphQLString) },
    action: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: GraphQLString },
    payload: { type: JSONScalar },
  },
});

const SyncPageType = new GraphQLObjectType({
  name: 'SyncChangesPage',
  fields: {
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ChangeType))) },
    nextCursor: { type: new GraphQLNonNull(GraphQLString) },
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const OperationKind = new GraphQLEnumType({
  name: 'OfflineOperationKind',
  values: {
    CREATE_CUSTOMER: {}, UPDATE_CUSTOMER: {}, UPDATE_DOCUMENT: {}, CREATE_CREDIT: {},
    UPDATE_CREDIT: {}, UPDATE_CREDIT_TERMS: {}, CREATE_PAYMENT: {}, UPDATE_PAYMENT: {},
    DELETE_PAYMENT: {}, DELETE_CREDIT: {}, APPLY_DISCOUNT: {}, ADD_INTEREST: {},
    CHANGE_CREDIT_STATUS: {}, REORDER_CREDIT: {}, CREATE_COMMENT: {}, UPDATE_COMMENT: {},
    DELETE_COMMENT: {}, UPSERT_ALERT: {},
  },
});

const OfflineInputType = new GraphQLInputObjectType({
  name: 'OfflineOperationInput',
  fields: {
    operationId: { type: new GraphQLNonNull(GraphQLString) },
    branchId: { type: new GraphQLNonNull(GraphQLInt) },
    kind: { type: new GraphQLNonNull(OperationKind) },
    entityId: { type: new GraphQLNonNull(GraphQLString) },
    baseVersion: { type: GraphQLString },
    payload: { type: new GraphQLNonNull(JSONScalar) },
  },
});

const OperationResultType = new GraphQLObjectType({
  name: 'OfflineOperationResult',
  fields: {
    operationId: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    entityId: { type: new GraphQLNonNull(GraphQLString) },
    data: { type: JSONScalar },
    eventCursor: { type: new GraphQLNonNull(GraphQLString) },
    replayed: { type: GraphQLBoolean },
  },
});

// --- Cartera sub-screens: Morosos, Retirados, Canceladas, Clientes De Cartera ---
const DefaulterCreditType = new GraphQLObjectType({
  name: 'DefaulterCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    balance: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, value: { type: GraphQLFloat },
    additionalValue: { type: GraphQLFloat }, createdAt: { type: GraphQLString },
    customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString },
  },
});

const WithdrawnCreditType = new GraphQLObjectType({
  name: 'WithdrawnCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    balance: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, value: { type: GraphQLFloat },
    additionalValue: { type: GraphQLFloat }, createdAt: { type: GraphQLString },
    customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, status: { type: GraphQLString },
  },
});

const CancelledCreditType = new GraphQLObjectType({
  name: 'CancelledCredit',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    value: { type: GraphQLFloat }, principal: { type: GraphQLFloat }, additionalValue: { type: GraphQLFloat },
    createdAt: { type: GraphQLString }, customerName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    phone: { type: GraphQLString }, paidAmount: { type: GraphQLFloat },
    description: { type: GraphQLString }, cancelledAt: { type: GraphQLString },
  },
});

const PortfolioClientType = new GraphQLObjectType({
  name: 'PortfolioClient',
  fields: {
    personId: { type: new GraphQLNonNull(GraphQLInt) },
    firstName: { type: GraphQLString }, lastName: { type: GraphQLString },
    documentType: { type: GraphQLString }, documentNumber: { type: GraphQLString },
    sex: { type: GraphQLString }, birthDate: { type: GraphQLString }, occupation: { type: GraphQLString },
    phone: { type: GraphQLString }, email: { type: GraphQLString }, department: { type: GraphQLString },
    city: { type: GraphQLString }, neighborhood: { type: GraphQLString }, street: { type: GraphQLString },
    customerStatus: { type: GraphQLString }, maxCredit: { type: GraphQLFloat }, nickname: { type: GraphQLString },
  },
});

const RestoreCreditResultType = new GraphQLObjectType({
  name: 'RestoreCreditResult',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    previousState: { type: new GraphQLNonNull(GraphQLString) },
    state: { type: new GraphQLNonNull(GraphQLString) },
  },
});

function auth(context: { auth: AuthContext | null }) { return context.auth; }

const loginArgs = z.object({
  companyId: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string(),
});

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    me: { type: AuthContextType, resolve: (_source, _args, context: { auth: AuthContext | null }) => me(auth(context)) },
    branches: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(BranchType))), resolve: (_source, _args, context: { auth: AuthContext | null }) => branches(auth(context)) },
    portfolio: {
      type: new GraphQLNonNull(PortfolioType),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) }, first: { type: GraphQLInt, defaultValue: 50 },
        after: { type: GraphQLString }, snapshotCursor: { type: GraphQLString },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        portfolio(auth(context), args.branchId, args.first, args.after, args.snapshotCursor),
    },
    customerById: {
      type: CustomerType,
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) => customerById(auth(context), args.branchId, args.id),
    },
    customerByDocument: {
      type: CustomerType,
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        documentType: { type: new GraphQLNonNull(GraphQLString) },
        documentNumber: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        customerByDocument(auth(context), args.branchId, args.documentType, args.documentNumber),
    },
    paymentHistory: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PaymentType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, creditId: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        paymentHistory(auth(context), args.branchId, String(args.creditId)),
    },
    receiptSequences: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ReceiptSequenceType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        receiptSequences(auth(context), args.branchId),
    },
    syncChanges: {
      type: new GraphQLNonNull(SyncPageType),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) }, after: { type: new GraphQLNonNull(GraphQLString) },
        first: { type: GraphQLInt, defaultValue: 100 },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        syncChanges(auth(context), args.branchId, args.after, args.first),
    },
    branchPermissions: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        branchPermissions(auth(context), args.branchId),
    },
    defaultersOfPortfolio: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(DefaulterCreditType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        defaultersOfPortfolio(auth(context), args.branchId),
    },
    withdrawnOfPortfolio: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(WithdrawnCreditType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        withdrawnOfPortfolio(auth(context), args.branchId),
    },
    cancelledCredits: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CancelledCreditType))),
      args: {
        branchId: { type: new GraphQLNonNull(GraphQLInt) },
        dateFrom: { type: new GraphQLNonNull(GraphQLString) },
        dateTo: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        cancelledCredits(auth(context), args.branchId, args.dateFrom, args.dateTo),
    },
    portfolioClients: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PortfolioClientType))),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        portfolioClients(auth(context), args.branchId),
    },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    login: {
      type: new GraphQLNonNull(AuthPayloadType),
      args: {
        companyId: { type: new GraphQLNonNull(GraphQLInt) },
        username: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: async (_source, args) => {
        const checked = loginArgs.safeParse(args);
        if (!checked.success) fail('VALIDATION_ERROR', 'Invalid login input');
        const payload = await login(checked.data.companyId, checked.data.username, checked.data.password);
        return {
          ...payload,
          company: { id: payload.user.companyId, name: payload.user.companyName },
        };
      },
    },
    applyOfflineOperation: {
      type: new GraphQLNonNull(OperationResultType),
      args: { input: { type: new GraphQLNonNull(OfflineInputType) } },
      resolve: (_source, args: { input: OfflineInput }, context: { auth: AuthContext | null }) =>
        applyOfflineOperation(auth(context), args.input),
    },
    restoreCredit: {
      type: new GraphQLNonNull(RestoreCreditResultType),
      args: { branchId: { type: new GraphQLNonNull(GraphQLInt) }, creditId: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_source, args, context: { auth: AuthContext | null }) =>
        restoreCredit(auth(context), args.branchId, String(args.creditId)),
    },
  },
});

export const schema = new GraphQLSchema({ query: Query, mutation: Mutation });
