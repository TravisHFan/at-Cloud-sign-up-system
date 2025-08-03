/**
 * TRIO SYSTEM REFACTORING - Phase 1 Migration Script
 * 
 * This script performs the API standardization migration by:
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
 * 1. Auditing all current Message.createForAllUsers usage
 * 2. Creating migration plan with backup annotations
 * 3. Gradually migrating to UnifiedMessageController.createTargetedSystemMessage
 * 
 * Usage: npm run migrate-trio-phase1
 */

import { promises as fs } from 'fs';
import path from 'path';

interface DeprecatedUsage {
  file: string;
  line: number;
  content: string;
  context: string[];
  functionName: string;
}

interface MigrationReport {
  deprecatedUsages: DeprecatedUsage[];
  standardUsages: number;
  totalFiles: number;
  migrationPlan: string[];
}

class TrioMigrationTool {
  private readonly srcDir = path.resolve(__dirname, '../../src');
  private readonly migrationBackupDir = path.resolve(__dirname, '../../migration-backup');
  
  /**
   * Phase 1: Audit all trio creation patterns
   */
  async auditTrioPatterns(): Promise<MigrationReport> {
    console.log('🔍 TRIO SYSTEM AUDIT - Phase 1 API Standardization\n');
    
    const report: MigrationReport = {
      deprecatedUsages: [],
      standardUsages: 0,
      totalFiles: 0,
      migrationPlan: []
    };

    const files = await this.getAllTypeScriptFiles(this.srcDir);
    report.totalFiles = files.length;

    for (const file of files) {
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      // Look for deprecated Message.createForAllUsers pattern
      const deprecatedMatches = this.findDeprecatedUsages(lines, file);
      report.deprecatedUsages.push(...deprecatedMatches);
      
      // Count standard UnifiedMessageController.createTargetedSystemMessage usage
      const standardCount = this.countStandardUsages(content);
      report.standardUsages += standardCount;
    }

    // Generate migration plan
    report.migrationPlan = this.generateMigrationPlan(report.deprecatedUsages);
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
    
    this.printAuditReport(report);
    return report;
  }

      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
  /**
   * Find all deprecated Message.createForAllUsers usages
   */
  private findDeprecatedUsages(lines: string[], file: string): DeprecatedUsage[] {
    const usages: DeprecatedUsage[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('Message.createForAllUsers')) {
        // Get surrounding context (3 lines before and after)
        const contextStart = Math.max(0, i - 3);
        const contextEnd = Math.min(lines.length - 1, i + 3);
        const context = lines.slice(contextStart, contextEnd + 1);
        
        // Try to identify the containing function
        const functionName = this.findContainingFunction(lines, i);
        
        usages.push({
          file: path.relative(this.srcDir, file),
          line: i + 1,
          content: line.trim(),
          context,
          functionName
        });
      }
    }
    
    return usages;
  }

  /**
   * Count standard UnifiedMessageController.createTargetedSystemMessage usages
   */
  private countStandardUsages(content: string): number {
    const matches = content.match(/UnifiedMessageController\.createTargetedSystemMessage/g);
    return matches ? matches.length : 0;
  }

  /**
   * Find the containing function name for context
   */
  private findContainingFunction(lines: string[], lineIndex: number): string {
    // Look backwards for function declaration
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      
      // Look for function declarations
      const functionMatch = line.match(/(?:static\s+)?(?:async\s+)?(\w+)\s*\(/);
      if (functionMatch) {
        return functionMatch[1];
      }
      
      // Look for arrow functions
      const arrowMatch = line.match(/const\s+(\w+)\s*=.*=>/);
      if (arrowMatch) {
        return arrowMatch[1];
      }
    }
    
    return 'unknown';
  }
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1

  /**
   * Generate step-by-step migration plan
   */
  private generateMigrationPlan(usages: DeprecatedUsage[]): string[] {
    const plan: string[] = [];
    
    plan.push('📋 MIGRATION PLAN - API Standardization');
    plan.push('═'.repeat(50));
    plan.push('');
    
    if (usages.length === 0) {
      plan.push('✅ No deprecated Message.createForAllUsers patterns found!');
      plan.push('✅ All code is already using standard UnifiedMessageController pattern.');
      return plan;
    }
    
    plan.push(`📊 Found ${usages.length} deprecated usage(s) to migrate:`);
    plan.push('');
    
    // Group by file for better organization
    const byFile = usages.reduce((acc, usage) => {
      if (!acc[usage.file]) acc[usage.file] = [];
      acc[usage.file].push(usage);
      return acc;
    }, {} as Record<string, DeprecatedUsage[]>);
    
    Object.entries(byFile).forEach(([file, fileUsages], index) => {
      plan.push(`${index + 1}. 📄 ${file}`);
      fileUsages.forEach((usage, usageIndex) => {
        plan.push(`   ${String.fromCharCode(97 + usageIndex)}. Line ${usage.line} in function ${usage.functionName}()`);
        plan.push(`      Current: ${usage.content}`);
        plan.push(`      Action:  Migrate to UnifiedMessageController.createTargetedSystemMessage`);
      });
      plan.push('');
    });
    
    plan.push('🔧 MIGRATION STEPS:');
    plan.push('1. Create backup of each file before modification');
    plan.push('2. Add deprecation annotations to existing code');
    plan.push('3. Implement new pattern alongside old pattern');
    plan.push('4. Test both patterns work identically');
    plan.push('5. Remove deprecated pattern');
    plan.push('6. Update all calls to use new pattern');
    
    return plan;
  }

  /**
   * Get all TypeScript files recursively
   */
  private async getAllTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip test directories and node_modules
          if (!['tests', 'test', '__tests__', 'node_modules'].includes(entry.name)) {
            const subFiles = await this.getAllTypeScriptFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}`);
    }
    
    return files;
  }

  /**
   * Print comprehensive audit report
   */
  private printAuditReport(report: MigrationReport): void {
    console.log('📊 TRIO SYSTEM AUDIT RESULTS');
    console.log('═'.repeat(50));
    console.log(`📁 Files scanned: ${report.totalFiles}`);
    console.log(`✅ Standard pattern usages: ${report.standardUsages}`);
    console.log(`❌ Deprecated pattern usages: ${report.deprecatedUsages.length}`);
    console.log('');
    
    if (report.deprecatedUsages.length > 0) {
      console.log('🚨 DEPRECATED PATTERNS FOUND:');
      console.log('');
      
      report.deprecatedUsages.forEach((usage, index) => {
        console.log(`${index + 1}. 📄 ${usage.file}:${usage.line}`);
        console.log(`   Function: ${usage.functionName}()`);
        console.log(`   Code: ${usage.content}`);
        console.log('   Context:');
        usage.context.forEach((line, i) => {
          const lineNum = usage.line - 3 + i;
          const marker = lineNum === usage.line ? '>>>' : '   ';
          console.log(`   ${marker} ${lineNum}: ${line}`);
        });
        console.log('');
      });
    }
    
    console.log('📋 MIGRATION PLAN:');
    console.log('');
    report.migrationPlan.forEach(line => console.log(line));
  }

  /**
   * Create backup of files before migration
   */
  async createMigrationBackup(): Promise<void> {
    console.log('💾 Creating migration backup...');
    
    // Ensure backup directory exists
    await fs.mkdir(this.migrationBackupDir, { recursive: true });
    
    const files = await this.getAllTypeScriptFiles(this.srcDir);
    
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
    for (const file of files) {
      const relativePath = path.relative(this.srcDir, file);
      const backupPath = path.join(this.migrationBackupDir, relativePath);
      
      // Ensure backup subdirectory exists
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(file, backupPath);
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
    }
    
    console.log(`✅ Backup created in ${path.relative(process.cwd(), this.migrationBackupDir)}`);
  }

  /**
   * Add deprecation annotations to existing Message.createForAllUsers usages
   */
  async addDeprecationAnnotations(report: MigrationReport): Promise<void> {
    console.log('📝 Adding deprecation annotations...');
    
    for (const usage of report.deprecatedUsages) {
      const filePath = path.join(this.srcDir, usage.file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Add deprecation comment before the usage
      const deprecationComment = [
        '      // ⚠️ DEPRECATED: Message.createForAllUsers pattern',
        '      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage',
        '      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1',
      ];
      
      // Insert deprecation comment before the line
      lines.splice(usage.line - 1, 0, ...deprecationComment);
      
      // Write back to file
      const newContent = lines.join('\n');
      await fs.writeFile(filePath, newContent, 'utf-8');
      
      console.log(`✅ Added deprecation annotation to ${usage.file}:${usage.line}`);
    }
    
    console.log('✅ All deprecation annotations added');
  }

  /**
   * Generate migration tracking file
   */
  async generateTrackingFile(report: MigrationReport): Promise<void> {
    const trackingContent = `# TRIO SYSTEM REFACTORING - Phase 1 Progress Tracking

**Date**: ${new Date().toISOString().split('T')[0]}
**Phase**: 1 - API Standardization
**Status**: 📋 IN PROGRESS

## 📊 Migration Statistics

- **Total Files Scanned**: ${report.totalFiles}
- **Standard Pattern Usages**: ${report.standardUsages}
- **Deprecated Pattern Usages**: ${report.deprecatedUsages.length}
- **Migration Progress**: ${report.deprecatedUsages.length === 0 ? '100%' : '0%'} Complete

## 🚨 Deprecated Patterns Found

${report.deprecatedUsages.length === 0 ? 
  '✅ No deprecated patterns found! All code is already standardized.' :
  report.deprecatedUsages.map((usage, index) => 
    `${index + 1}. **${usage.file}:${usage.line}** - Function: \`${usage.functionName}()\`
   \`\`\`typescript
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
   ${usage.content}
   \`\`\``
  ).join('\n\n')
}

## 📋 Migration Checklist

${report.deprecatedUsages.map((usage, index) => 
  `- [ ] **${usage.file}:${usage.line}** - Migrate \`${usage.functionName}()\` function`
).join('\n')}

## 🔧 Next Steps

1. **Backup Creation**: ✅ Complete
2. **Deprecation Annotations**: ✅ Complete  
3. **Pattern Migration**: 🔄 In Progress
4. **Testing & Validation**: ⏳ Pending
5. **Cleanup**: ⏳ Pending

## 📝 Migration Notes

- All deprecated \`Message.createForAllUsers\` calls have been annotated
- Each usage requires individual review for proper migration
- Test each migration to ensure trio functionality is maintained
- Remove deprecation annotations after successful migration

---
*Generated by Trio Migration Tool on ${new Date().toLocaleString()}*
`;

    const trackingPath = path.resolve(__dirname, '../../TRIO_MIGRATION_PHASE1_TRACKING.md');
    await fs.writeFile(trackingPath, trackingContent, 'utf-8');
    
    console.log(`📋 Migration tracking file created: ${path.relative(process.cwd(), trackingPath)}`);
  }
}

/**
 * Main execution function
 */
async function runPhase1Migration(): Promise<void> {
  console.log('🚀 TRIO SYSTEM REFACTORING - Phase 1 API Standardization');
  console.log('═'.repeat(60));
  console.log('');

  const migrationTool = new TrioMigrationTool();

  try {
    // Step 1: Audit current patterns
    const report = await migrationTool.auditTrioPatterns();
    
    // Step 2: Create backup
    await migrationTool.createMigrationBackup();
    
    // Step 3: Add deprecation annotations
    if (report.deprecatedUsages.length > 0) {
      await migrationTool.addDeprecationAnnotations(report);
    }
    
    // Step 4: Generate tracking file
    await migrationTool.generateTrackingFile(report);
    
    console.log('');
    console.log('✅ Phase 1 Migration Preparation Complete!');
    console.log('');
    console.log('📋 What was done:');
    console.log('1. ✅ Full codebase audit completed');
    console.log('2. ✅ Migration backup created');
    console.log('3. ✅ Deprecation annotations added');
    console.log('4. ✅ Progress tracking file generated');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. Review deprecation annotations in code');
    console.log('2. Begin manual migration of each deprecated usage');
    console.log('3. Test each migration thoroughly');
    console.log('4. Update tracking file progress');
    console.log('');
    console.log('📄 Files to review:');
    console.log('- TRIO_MIGRATION_PHASE1_TRACKING.md (progress tracking)');
    console.log('- migration-backup/ (original code backup)');
    console.log('- Source files with deprecation annotations');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runPhase1Migration();
}

export { TrioMigrationTool, runPhase1Migration };
