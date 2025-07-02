export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'language', {
            type: Sequelize.STRING,
            defaultValue: 'en-US',
            allowNull: false,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'language');
    }
};